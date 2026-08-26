import { semaineEtJour } from './calendrier';
import { supabase } from './supabase';

import type { CardioType, Intervalles, SessionType } from './programGenerator';

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
