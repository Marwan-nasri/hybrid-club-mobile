import { semaineEtJour } from './calendrier';
import { supabase } from './supabase';

import type { CardioType, GoalType, Intervalles, LevelType, SessionType } from './programGenerator';

const LIBELLE_CARDIO: Record<CardioType, string> = {
  course: 'Course',
  rameur: 'Rameur',
  assault_bike: 'Assault bike',
  ski_erg: 'Ski erg',
  velo: 'Vélo',
  marche_inclinee: 'Marche inclinée',
};

export const LIBELLE_TYPE: Record<SessionType, string> = {
  muscu: 'Musculation',
  cardio: 'Cardio',
  hybride: 'Hybride',
  repos: 'Repos actif',
};

/** Un bloc tel qu'affiché en aperçu : « Développé couché » / « 4×6 ». */
export type Bloc = { nom: string; dose: string | null };

export type Seance = {
  id: string;
  jour: number;
  type: SessionType;
  nom: string;
  duree_estimee_min: number | null;
  blocs: Bloc[];
};

export type EtatSemaine =
  | { statut: 'sans_programme' }
  | { statut: 'termine' }
  | { statut: 'ok'; semaine: number; duree_semaines: number; jour: number; seances: Seance[] };

type LigneBloc = {
  series: number | null;
  reps_cible: string | null;
  cardio_type: CardioType | null;
  distance_m: number | null;
  duree_sec: number | null;
  intervalles: Intervalles | null;
  exercises: { nom: string } | null;
};

type LigneSeance = {
  id: string;
  jour: number;
  type: SessionType;
  nom: string;
  duree_estimee_min: number | null;
  session_blocks: LigneBloc[];
};

/**
 * La dose prescrite, telle qu'elle est en base.
 *
 * La charge en kg de la maquette B1 n'y figure pas : `creer_programme` ne
 * persiste que `pct_1rm`, et les 1RM qui permettraient de la dériver vivent
 * dans le profil d'onboarding, effacé après l'insertion. Rien à afficher tant
 * que `profiles` n'est pas écrit — voir la note de fin de tâche.
 */
function dose(b: LigneBloc): string | null {
  if (b.series && b.reps_cible) return `${b.series}\u00d7${b.reps_cible}`;
  if (b.reps_cible) return b.reps_cible;
  if (b.intervalles) return `${b.intervalles.repetitions}\u00d7${b.intervalles.effort_sec} s`;
  if (b.distance_m) {
    return b.distance_m >= 1000
      ? `${String(b.distance_m / 1000).replace('.', ',')} km`
      : `${b.distance_m} m`;
  }
  if (b.duree_sec) return `${Math.round(b.duree_sec / 60)} min`;
  return null;
}

/**
 * Les séances de la semaine en cours du programme actif.
 *
 * Deux allers-retours et pas un : la semaine à demander se déduit de
 * `date_debut`, qui arrive avec la première réponse. Tout charger d'un coup
 * voudrait dire rapatrier les 12 semaines pour n'en afficher qu'une.
 */
export async function chargerSemaine(aujourdhui: Date): Promise<EtatSemaine> {
  const { data: programme, error: erreurProgramme } = await supabase
    .from('programs')
    .select('id, date_debut, duree_semaines')
    .eq('is_active', true)
    .maybeSingle();

  if (erreurProgramme) throw erreurProgramme;
  if (!programme) return { statut: 'sans_programme' };

  const { semaine, jour } = semaineEtJour(programme.date_debut, aujourdhui);
  if (semaine < 1 || semaine > programme.duree_semaines) return { statut: 'termine' };

  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, jour, type, nom, duree_estimee_min, ' +
        'session_blocks(series, reps_cible, cardio_type, distance_m, duree_sec, intervalles, exercises(nom))',
    )
    .eq('program_id', programme.id)
    .eq('semaine', semaine)
    .order('jour')
    // Tous les blocs, pas les 3 premiers : le « + N exercices » de B1 a besoin
    // du compte total. ~5 blocs par séance, 7 séances — la charge est nulle.
    .order('ordre', { referencedTable: 'session_blocks' })
    .returns<LigneSeance[]>();

  if (error) throw error;

  return {
    statut: 'ok',
    semaine,
    duree_semaines: programme.duree_semaines,
    jour,
    seances: (data ?? []).map((s) => ({
      id: s.id,
      jour: s.jour,
      type: s.type,
      nom: s.nom,
      duree_estimee_min: s.duree_estimee_min,
      blocs: s.session_blocks
        .map((b) => ({
          nom: b.exercises?.nom ?? (b.cardio_type ? LIBELLE_CARDIO[b.cardio_type] : null),
          dose: dose(b),
        }))
        .filter((b): b is Bloc => b.nom !== null),
    })),
  };
}

// ── Onglet Programme (B2) ────────────────────────────────────────────────────

/**
 * Le statut réel d'une séance, lu dans `workout_logs`.
 *
 * Contrairement à l'onglet Aujourd'hui — écrit quand `workout_logs` n'était
 * alimenté par personne — la complétion est ici une vraie donnée : l'écran de
 * séance écrit `statut = 'termine'` à la clôture.
 */
export type StatutSeance = 'termine' | 'en_cours' | 'a_venir';

/** Un des 7 jours de la semaine affichée. `session` à `null` = repos. */
export type JourProgramme = {
  jour: number;
  session: { id: string; nom: string; type: SessionType; duree_estimee_min: number | null } | null;
  statut: StatutSeance | null;
};

export type BlocProgramme = {
  id: string;
  nom: string;
  objectif: GoalType;
  niveau: LevelType;
  duree_semaines: number;
  /** Semaine courante, bornée au bloc : avant le début → 1, après la fin → la dernière. */
  semaine_courante: number;
  /** Hors des 12 semaines — l'écran le signale plutôt que de mentir sur la semaine. */
  hors_bloc: boolean;
  jour: number;
  total_seances: number;
  seances_terminees: number;
};

export type EtatBloc = { statut: 'sans_programme' } | { statut: 'ok'; bloc: BlocProgramme };

export type ProgrammeActif = {
  id: string;
  nom: string;
  objectif: GoalType;
  niveau: LevelType;
  date_debut: string;
  duree_semaines: number;
};

/** Le bloc actif, ou `null` s'il n'y en a pas. Le programme est unique par user. */
export async function programmeActif(): Promise<ProgrammeActif | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('id, nom, objectif, niveau, date_debut, duree_semaines')
    .eq('is_active', true)
    .maybeSingle<ProgrammeActif>();

  if (error) throw error;
  return data;
}

/**
 * Séances terminées / séances prescrites, sur tout le bloc ou sur une tranche
 * de semaines.
 *
 * `terminees` compte les `workout_logs` à `termine` rattachés à ce programme,
 * via la jointure interne sur `sessions` — un log d'un bloc archivé ne doit pas
 * gonfler la progression du bloc courant. La tranche se donne en semaines et
 * non en dates : c'est `sessions.semaine` qui porte le calendrier du prescrit.
 */
export async function compterSeances(
  programId: string,
  semaines?: { de: number; a: number },
): Promise<{ total: number; terminees: number }> {
  let prescrites = supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId);

  let faites = supabase
    .from('workout_logs')
    .select('id, sessions!inner(program_id, semaine)', { count: 'exact', head: true })
    .eq('statut', 'termine')
    .eq('sessions.program_id', programId);

  if (semaines) {
    prescrites = prescrites.gte('semaine', semaines.de).lte('semaine', semaines.a);
    faites = faites.gte('sessions.semaine', semaines.de).lte('sessions.semaine', semaines.a);
  }

  const [total, terminees] = await Promise.all([prescrites, faites]);

  if (total.error) throw total.error;
  if (terminees.error) throw terminees.error;

  return { total: total.count ?? 0, terminees: terminees.count ?? 0 };
}

/**
 * L'en-tête de l'onglet Programme : le bloc actif et sa progression réelle.
 */
export async function chargerBloc(aujourdhui: Date): Promise<EtatBloc> {
  const programme = await programmeActif();
  if (!programme) return { statut: 'sans_programme' };

  const { total, terminees } = await compterSeances(programme.id);
  const { semaine, jour } = semaineEtJour(programme.date_debut, aujourdhui);
  const horsBloc = semaine < 1 || semaine > programme.duree_semaines;

  return {
    statut: 'ok',
    bloc: {
      id: programme.id,
      nom: programme.nom,
      objectif: programme.objectif,
      niveau: programme.niveau,
      duree_semaines: programme.duree_semaines,
      semaine_courante: Math.min(Math.max(semaine, 1), programme.duree_semaines),
      hors_bloc: horsBloc,
      jour,
      total_seances: total,
      seances_terminees: terminees,
    },
  };
}

type LigneJour = {
  id: string;
  jour: number;
  type: SessionType;
  nom: string;
  duree_estimee_min: number | null;
  workout_logs: { statut: string | null }[];
};

/**
 * Les 7 jours d'une semaine du bloc, statut compris.
 *
 * Les `workout_logs` sont embarqués plutôt que demandés à part : chaque semaine
 * a ses propres lignes `sessions` (contrainte unique program_id/semaine/jour),
 * donc un log pointe une semaine précise et la jointure suffit.
 */
export async function chargerSemaineBloc(
  programId: string,
  semaine: number,
): Promise<JourProgramme[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, jour, type, nom, duree_estimee_min, workout_logs(statut)')
    .eq('program_id', programId)
    .eq('semaine', semaine)
    .order('jour')
    .returns<LigneJour[]>();

  if (error) throw error;

  const parJour = new Map((data ?? []).map((s) => [s.jour, s]));

  return Array.from({ length: 7 }, (_, i) => {
    const s = parJour.get(i + 1);
    if (!s) return { jour: i + 1, session: null, statut: null };

    const statuts = s.workout_logs.map((l) => l.statut);
    return {
      jour: i + 1,
      session: { id: s.id, nom: s.nom, type: s.type, duree_estimee_min: s.duree_estimee_min },
      statut:
        statuts.includes('termine') ? 'termine'
        : statuts.includes('en_cours') ? 'en_cours'
        : 'a_venir',
    };
  });
}
