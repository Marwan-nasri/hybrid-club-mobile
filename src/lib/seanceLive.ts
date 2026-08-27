import { supabase } from './supabase';

import type { CardioType, Intervalles, SessionType } from './programGenerator';

/**
 * Données de l'écran de séance : la prescription lue depuis `sessions` /
 * `session_blocks`, l'historique lu depuis `set_logs`, et l'écriture du réalisé
 * dans `workout_logs` / `set_logs`.
 *
 * La séparation prescrit / réalisé du schéma tient ici aussi : rien de ce que
 * l'utilisateur fait ne repart vers une table de programme.
 *
 * ponytail: écriture directe à chaque validation de série, pas de file d'attente
 * offline. Le `client_uuid` est posé dès maintenant pour que la déduplication
 * soit possible le jour où la synchro différée arrive.
 */

/** Le `client_uuid` ne sert qu'à dédupliquer une reprise : pas un secret. */
function uuidClient(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 0x3) | 0x8).toString(16);
  });
}

const LIBELLE_CARDIO: Record<CardioType, string> = {
  course: 'Course',
  rameur: 'Rameur',
  assault_bike: 'Assault bike',
  ski_erg: 'Ski erg',
  velo: 'Vélo',
  marche_inclinee: 'Marche inclinée',
};

/** Un bloc de musculation : le seul type que l'écran sait enregistrer. */
export type BlocExercice = {
  kind: 'exercice';
  exercise_id: string;
  nom: string;
  series: number;
  reps_cible: string | null;
  rpe: number | null;
  repos_sec: number | null;
  notes: string | null;
  /** Charge et reps de la dernière fois, `null` si jamais fait. */
  precedent: { charge_kg: number | null; reps: number | null; series: number } | null;
};

/** Un bloc cardio : affiché, mais pas enregistré — `cardio_logs` attend. */
export type BlocCardio = {
  kind: 'cardio';
  nom: string;
  detail: string | null;
  notes: string | null;
};

export type Bloc = BlocExercice | BlocCardio;

export type SeanceLive = {
  id: string;
  nom: string;
  type: SessionType;
  duree_estimee_min: number | null;
  note_coaching: string | null;
  blocs: Bloc[];
};

type LigneBloc = {
  ordre: number;
  series: number | null;
  reps_cible: string | null;
  rpe: number | null;
  repos_sec: number | null;
  cardio_type: CardioType | null;
  distance_m: number | null;
  duree_sec: number | null;
  intervalles: Intervalles | null;
  notes: string | null;
  exercise_id: string | null;
  exercises: { nom: string } | null;
};

type LigneSeance = {
  id: string;
  nom: string;
  type: SessionType;
  duree_estimee_min: number | null;
  note_coaching: string | null;
  session_blocks: LigneBloc[];
};

type LigneHistorique = {
  workout_log_id: string;
  exercise_id: string;
  reps: number | null;
  charge_kg: number | null;
};

function detailCardio(b: LigneBloc): string | null {
  if (b.intervalles) {
    const i = b.intervalles;
    return `${i.repetitions}×${i.effort_sec} s · récup ${i.recup_sec} s`;
  }
  if (b.distance_m) {
    return b.distance_m >= 1000
      ? `${String(b.distance_m / 1000).replace('.', ',')} km`
      : `${b.distance_m} m`;
  }
  if (b.duree_sec) return `${Math.round(b.duree_sec / 60)} min`;
  return null;
}

/**
 * La dernière fois sur chaque exercice, en un seul aller-retour.
 *
 * On prend la série la plus récente de l'exercice, puis toutes celles du même
 * `workout_log_id` pour reconstituer « 4×6 @ 92,5 kg ». La RLS de `set_logs`
 * limite déjà la lecture aux séances de l'utilisateur.
 *
 * ponytail: plafonné à 200 lignes. Un exercice très répété pourrait en théorie
 * masquer un exercice rare de la même séance — passer à une requête par
 * exercice, ou à une vue, si ça se produit.
 */
async function historique(
  exerciseIds: string[],
): Promise<Map<string, BlocExercice['precedent']>> {
  const parExercice = new Map<string, BlocExercice['precedent']>();
  if (exerciseIds.length === 0) return parExercice;

  const { data, error } = await supabase
    .from('set_logs')
    .select('workout_log_id, exercise_id, reps, charge_kg')
    .in('exercise_id', exerciseIds)
    .eq('is_echauffement', false)
    .order('completed_at', { ascending: false })
    .limit(200)
    .returns<LigneHistorique[]>();

  if (error) throw error;

  for (const ligne of data ?? []) {
    if (parExercice.has(ligne.exercise_id)) continue;
    const memeSeance = (data ?? []).filter(
      (l) => l.exercise_id === ligne.exercise_id && l.workout_log_id === ligne.workout_log_id,
    );
    parExercice.set(ligne.exercise_id, {
      charge_kg: ligne.charge_kg,
      reps: ligne.reps,
      series: memeSeance.length,
    });
  }

  return parExercice;
}

export async function chargerSeance(sessionId: string): Promise<SeanceLive> {
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, nom, type, duree_estimee_min, note_coaching, ' +
        'session_blocks(ordre, series, reps_cible, rpe, repos_sec, cardio_type, ' +
        'distance_m, duree_sec, intervalles, notes, exercise_id, exercises(nom))',
    )
    .eq('id', sessionId)
    .order('ordre', { referencedTable: 'session_blocks' })
    .single<LigneSeance>();

  if (error) throw error;

  const ids = data.session_blocks
    .map((b) => b.exercise_id)
    .filter((v): v is string => v !== null);
  const precedents = await historique(ids);

  return {
    id: data.id,
    nom: data.nom,
    type: data.type,
    duree_estimee_min: data.duree_estimee_min,
    note_coaching: data.note_coaching,
    blocs: data.session_blocks.map((b): Bloc => {
      if (b.exercise_id && b.exercises) {
        return {
          kind: 'exercice',
          exercise_id: b.exercise_id,
          nom: b.exercises.nom,
          series: b.series ?? 1,
          reps_cible: b.reps_cible,
          rpe: b.rpe,
          repos_sec: b.repos_sec,
          notes: b.notes,
          precedent: precedents.get(b.exercise_id) ?? null,
        };
      }
      return {
        kind: 'cardio',
        nom: b.cardio_type ? LIBELLE_CARDIO[b.cardio_type] : 'Bloc libre',
        detail: detailCardio(b),
        notes: b.notes,
      };
    }),
  };
}

/**
 * Ouvre la séance, ou reprend celle déjà en cours.
 *
 * Reprendre plutôt que recréer : l'app tuée en pleine séance rouvrirait sinon
 * un second `workout_logs`, et les séries déjà validées seraient orphelines.
 */
export async function demarrerSeance(sessionId: string): Promise<string> {
  const { data: utilisateur, error: erreurAuth } = await supabase.auth.getUser();
  if (erreurAuth) throw erreurAuth;
  if (!utilisateur.user) throw new Error('Aucun utilisateur connecté.');

  const { data: enCours, error: erreurLecture } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('session_id', sessionId)
    .eq('statut', 'en_cours')
    .order('date_debut', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erreurLecture) throw erreurLecture;
  if (enCours) return enCours.id as string;

  const { data, error } = await supabase
    .from('workout_logs')
    .insert({
      user_id: utilisateur.user.id,
      session_id: sessionId,
      statut: 'en_cours',
      client_uuid: uuidClient(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

export type SerieRealisee = {
  exercise_id: string;
  /** 1-indexé, comme la colonne `serie`. */
  serie: number;
  reps: number | null;
  charge_kg: number | null;
  rpe: number | null;
};

/**
 * Écrit une série validée.
 *
 * `upsert` et non `insert` : l'utilisateur peut dévalider, corriger, revalider.
 * La contrainte unique (workout_log_id, exercise_id, serie) fait la clé.
 */
export async function enregistrerSerie(
  workoutLogId: string,
  serie: SerieRealisee,
): Promise<void> {
  const { error } = await supabase.from('set_logs').upsert(
    {
      workout_log_id: workoutLogId,
      exercise_id: serie.exercise_id,
      serie: serie.serie,
      reps: serie.reps,
      charge_kg: serie.charge_kg,
      rpe: serie.rpe,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'workout_log_id,exercise_id,serie' },
  );
  if (error) throw error;
}

/** Dévalider une série la retire du réalisé — sinon elle compterait au volume. */
export async function supprimerSerie(
  workoutLogId: string,
  exerciseId: string,
  serie: number,
): Promise<void> {
  const { error } = await supabase
    .from('set_logs')
    .delete()
    .eq('workout_log_id', workoutLogId)
    .eq('exercise_id', exerciseId)
    .eq('serie', serie);
  if (error) throw error;
}

/**
 * Clôt la séance.
 *
 * `volume_total_kg` est recalculé depuis `set_logs` et non depuis l'état de
 * l'écran : c'est la base qui fait foi, et une série écrite puis l'app relancée
 * doit compter quand même.
 */
export async function terminerSeance(workoutLogId: string, dureeSec: number): Promise<number> {
  const { data: series, error: erreurLecture } = await supabase
    .from('set_logs')
    .select('reps, charge_kg')
    .eq('workout_log_id', workoutLogId)
    .eq('is_echauffement', false)
    .returns<{ reps: number | null; charge_kg: number | null }[]>();

  if (erreurLecture) throw erreurLecture;

  const volume = (series ?? []).reduce((total, s) => total + (s.reps ?? 0) * (s.charge_kg ?? 0), 0);

  const { error } = await supabase
    .from('workout_logs')
    .update({
      statut: 'termine',
      date_fin: new Date().toISOString(),
      duree_sec: dureeSec,
      volume_total_kg: volume,
    })
    .eq('id', workoutLogId);

  if (error) throw error;
  return volume;
}

/**
 * Le statut réel d'une séance, pour un écran qui ne la démarre pas encore.
 *
 * Même lecture que `demarrerSeance`, mais sans reprise : le détail de séance
 * (B3) doit distinguer « déjà faite » de « à venir » avant d'ouvrir quoi que
 * ce soit dans `workout_logs`.
 */
export async function statutSeance(
  sessionId: string,
): Promise<'termine' | 'en_cours' | 'a_venir'> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('statut')
    .eq('session_id', sessionId)
    .returns<{ statut: string | null }[]>();

  if (error) throw error;

  const statuts = (data ?? []).map((l) => l.statut);
  return statuts.includes('termine') ? 'termine'
    : statuts.includes('en_cours') ? 'en_cours'
    : 'a_venir';
}
