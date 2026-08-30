import { semaineEtJour } from './calendrier';
import { agreger, debutPeriode, SEMAINES_PERIODE } from './progressionCalcul';
import { compterSeances, programmeActif } from './seances';
import { supabase } from './supabase';

import type { LigneSet, Periode, Progression } from './progressionCalcul';

/**
 * Onglet Progression (B8) et détail d'un exercice (B9) : les lectures.
 *
 * Tout vient de `set_logs` — le réalisé, jamais le prescrit. Ce qui n'a pas de
 * donnée derrière est absent plutôt qu'à zéro :
 *
 * - pas d'allure moyenne : `cardio_logs` n'est écrit par personne ;
 * - pas de record ni de 1RM estimé : la méthode de calcul reste à décider, on
 *   n'affiche que la dernière performance brute.
 *
 * Le calcul lui-même vit dans progressionCalcul.ts, réexporté ici pour que les
 * écrans n'aient qu'un import.
 */

export * from './progressionCalcul';

/**
 * Tout l'écran B8 pour une période.
 *
 * Les séries sont agrégées côté client : sommer par semaine côté Postgres
 * demanderait une vue ou une RPC, donc une migration, pour ~100 lignes par
 * semaine d'entraînement.
 *
 * ponytail: plafonné à 5 000 séries, soit environ un an d'entraînement sérieux
 * sur la période *et* la précédente. Au-delà, les plus anciennes tombent et le
 * pourcentage de variation se met à mentir — passer à une RPC d'agrégation ce
 * jour-là.
 */
export async function chargerProgression(
  periode: Periode,
  aujourdhui: Date,
): Promise<Progression> {
  const nbSemaines = SEMAINES_PERIODE[periode];
  const debut = debutPeriode(periode, aujourdhui);
  const debutPrecedent = new Date(
    debut.getFullYear(),
    debut.getMonth(),
    debut.getDate() - nbSemaines * 7,
  );

  const [series, seances] = await Promise.all([
    supabase
      .from('set_logs')
      .select('exercise_id, reps, charge_kg, completed_at, exercises(nom)')
      .eq('is_echauffement', false)
      .gte('completed_at', debutPrecedent.toISOString())
      .order('completed_at', { ascending: false })
      .limit(5000)
      .returns<LigneSet[]>(),
    compterSeancesPeriode(debut, aujourdhui),
  ]);

  if (series.error) throw series.error;

  return { ...agreger(series.data ?? [], debut, aujourdhui, nbSemaines), seances };
}

/**
 * L'assiduité sur la période : le même comptage que la progression du bloc
 * (onglet Programme), borné aux semaines du programme que la période recouvre.
 *
 * La borne est en semaines de programme et non en dates parce que le prescrit
 * n'a pas de date : `sessions.semaine` + `programs.date_debut` en tiennent lieu.
 * Les semaines à venir sont exclues — la fenêtre s'arrête à la semaine en cours.
 */
async function compterSeancesPeriode(
  debut: Date,
  aujourdhui: Date,
): Promise<Progression['seances']> {
  const programme = await programmeActif();
  if (!programme) return null;

  const de = Math.max(1, semaineEtJour(programme.date_debut, debut).semaine);
  const a = Math.min(
    programme.duree_semaines,
    semaineEtJour(programme.date_debut, aujourdhui).semaine,
  );
  if (a < de) return { total: 0, terminees: 0 };

  return compterSeances(programme.id, { de, a });
}

// ── Détail d'un exercice (B9 allégé) ─────────────────────────────────────────

/** Une séance passée sur cet exercice, telle qu'elle a été loggée. */
export type SeanceExercice = {
  workout_log_id: string;
  date: Date;
  series: { reps: number | null; charge_kg: number | null }[];
  /** RPE moyen des séries qui en portent un, `null` si aucune. */
  rpe: number | null;
};

export type HistoriqueExercice = { nom: string; seances: SeanceExercice[] };

type LigneDetail = {
  workout_log_id: string;
  serie: number;
  reps: number | null;
  charge_kg: number | null;
  rpe: number | null;
  completed_at: string;
  exercises: { nom: string } | null;
};

/**
 * L'historique brut d'un exercice, séance par séance, du plus récent au plus
 * ancien. Pas de record, pas de 1RM estimé, pas de tendance : la méthode de
 * calcul reste à décider.
 *
 * ponytail: 200 séries, soit ~50 séances sur l'exercice. Pagination le jour où
 * quelqu'un fait défiler jusqu'au bout.
 */
export async function chargerHistoriqueExercice(
  exerciseId: string,
): Promise<HistoriqueExercice | null> {
  const { data, error } = await supabase
    .from('set_logs')
    .select('workout_log_id, serie, reps, charge_kg, rpe, completed_at, exercises(nom)')
    .eq('exercise_id', exerciseId)
    .eq('is_echauffement', false)
    .order('completed_at', { ascending: false })
    .limit(200)
    .returns<LigneDetail[]>();

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const parSeance = new Map<
    string,
    Omit<SeanceExercice, 'series'> & { series: { serie: number; reps: number | null; charge_kg: number | null }[]; rpes: number[] }
  >();

  for (const l of data) {
    let seance = parSeance.get(l.workout_log_id);
    if (!seance) {
      seance = {
        workout_log_id: l.workout_log_id,
        date: new Date(l.completed_at),
        series: [],
        rpe: null,
        rpes: [],
      };
      parSeance.set(l.workout_log_id, seance);
    }
    seance.series.push({
      serie: l.serie,
      reps: l.reps,
      charge_kg: l.charge_kg === null ? null : Number(l.charge_kg),
    });
    if (l.rpe !== null) seance.rpes.push(l.rpe);
  }

  const seances: SeanceExercice[] = [...parSeance.values()].map(({ rpes, ...s }) => ({
    ...s,
    // Les lignes arrivent du plus récent au plus ancien : on remet les séries
    // d'une même séance dans leur ordre d'exécution.
    series: [...s.series].sort((a, b) => a.serie - b.serie),
    rpe: rpes.length > 0 ? Math.round((rpes.reduce((t, r) => t + r, 0) / rpes.length) * 10) / 10 : null,
  }));

  return { nom: data[0].exercises?.nom ?? 'Exercice', seances };
}

