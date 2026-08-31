import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  aPousser,
  apresFlush,
  cloturerSeance,
  decoderCle,
  nouvelleSeance,
  poserSerie,
  retirerSerie,
  uuidClient,
  volumeLocal,
} from './seanceLocale';
import { supabase } from './supabase';

import type { CardioType, Intervalles, SessionType } from './programGenerator';
import type { EtatSeance } from './seanceLocale';

/**
 * Données de l'écran de séance : la prescription lue depuis `sessions` /
 * `session_blocks`, l'historique lu depuis `set_logs`, et l'écriture du réalisé
 * dans `workout_logs` / `set_logs`.
 *
 * La séparation prescrit / réalisé du schéma tient ici aussi : rien de ce que
 * l'utilisateur fait ne repart vers une table de programme.
 *
 * ## Offline-first
 *
 * Aucune des fonctions d'écriture ne touche le réseau sur son chemin critique.
 * Elles écrivent l'état local (`seanceLocale.ts`) dans AsyncStorage, puis
 * lancent `synchroniser()` sans l'attendre. Une coupure réseau ne peut donc
 * ni bloquer l'interface, ni perdre une série.
 *
 * L'identifiant que ces fonctions manipulent — celui que `demarrerSeance`
 * retourne et que les autres reçoivent — est le `client_uuid`, pas l'`id` de
 * `workout_logs`. C'est ce qui rend la séance jouable sans avoir jamais parlé
 * au serveur. La résolution vers l'`id` réel n'a lieu que dans le flush.
 *
 * La déduplication ne repose sur rien de nouveau : `workout_logs.client_uuid`
 * est unique, `set_logs (workout_log_id, exercise_id, serie)` aussi. Rejouer
 * un flush est sans effet — les deux contraintes ont été vérifiées sur la base
 * réelle le 2026-08-30, pas seulement dans les migrations.
 */

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

async function lireSeanceEnLigne(sessionId: string): Promise<SeanceLive> {
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
 * La séance prescrite, réseau d'abord, cache ensuite.
 *
 * Le cache n'existe que pour rendre la séance jouable hors ligne une fois
 * qu'elle a été lue au moins une fois — en arrivant depuis Aujourd'hui ou
 * depuis le détail de séance. Ce n'est pas un cache de lecture du programme :
 * changer de semaine sans réseau ne marche toujours pas.
 *
 * ponytail: pas d'invalidation. Un programme régénéré côté serveur servirait
 * l'ancienne séance hors ligne — impossible aujourd'hui, il n'y a ni fin de
 * cycle ni régénération. À revoir avec `program_cycles`.
 */
export async function chargerSeance(sessionId: string): Promise<SeanceLive> {
  try {
    const seance = await lireSeanceEnLigne(sessionId);
    await AsyncStorage.setItem(PREFIXE_PRESCRIT + sessionId, JSON.stringify(seance));
    return seance;
  } catch (erreur) {
    const brut = await AsyncStorage.getItem(PREFIXE_PRESCRIT + sessionId);
    if (!brut) throw erreur;
    return JSON.parse(brut) as SeanceLive;
  }
}

/* ------------------------------------------------------------------ *
 * Persistance locale
 * ------------------------------------------------------------------ */

/** Une séance en cours ou en attente de synchronisation, par `client_uuid`. */
const PREFIXE_SEANCE = 'seance.';
/** Le prescrit déjà lu, par `session_id`. Préfixe distinct : le balayage des séances ne doit pas le ramasser. */
const PREFIXE_PRESCRIT = 'prescrit.';

async function lireEtat(clientUuid: string): Promise<EtatSeance | null> {
  const brut = await AsyncStorage.getItem(PREFIXE_SEANCE + clientUuid);
  if (!brut) return null;
  try {
    return JSON.parse(brut) as EtatSeance;
  } catch {
    // Écriture interrompue : mieux vaut repartir de zéro que faire planter la séance.
    return null;
  }
}

async function ecrireEtat(etat: EtatSeance): Promise<void> {
  await AsyncStorage.setItem(PREFIXE_SEANCE + etat.client_uuid, JSON.stringify(etat));
}

async function tousLesEtats(): Promise<EtatSeance[]> {
  const cles = (await AsyncStorage.getAllKeys()).filter((c) => c.startsWith(PREFIXE_SEANCE));
  if (cles.length === 0) return [];
  return (await AsyncStorage.multiGet(cles)).flatMap(([, brut]) => {
    if (!brut) return [];
    try {
      return [JSON.parse(brut) as EtatSeance];
    } catch {
      return [];
    }
  });
}

/**
 * L'état local d'une session donnée.
 *
 * Une séance close mais pas encore synchronisée reste stockée : si
 * l'utilisateur relance la même session, c'est bien une séance en cours qu'il
 * faut lui rendre, pas celle qu'il vient de terminer. D'où la préférence
 * explicite, et le tri à défaut.
 */
async function etatPourSession(sessionId: string): Promise<EtatSeance | null> {
  const etats = (await tousLesEtats())
    .filter((e) => e.session_id === sessionId)
    .sort((a, b) => b.debut_iso.localeCompare(a.debut_iso));
  return etats.find((e) => e.statut === 'en_cours') ?? etats[0] ?? null;
}

/**
 * L'état local d'une séance, pour l'écran qui doit se reconstruire.
 *
 * C'est ce qui répare la reprise : jusqu'ici l'écran repartait d'un
 * pré-remplissage vierge après un redémarrage, et les séries déjà validées —
 * pourtant bien en base — n'y réapparaissaient pas.
 */
export async function etatSeance(clientUuid: string): Promise<EtatSeance | null> {
  return lireEtat(clientUuid);
}

/* ------------------------------------------------------------------ *
 * Synchronisation
 * ------------------------------------------------------------------ */

/**
 * Pousse une séance locale vers Supabase.
 *
 * L'ordre compte : `workout_logs` d'abord, pour obtenir l'`id` serveur dont
 * `set_logs.workout_log_id` a besoin. L'`upsert` sur `client_uuid` fait que
 * rejouer cette fonction ne crée jamais de seconde séance.
 */
async function pousser(etat: EtatSeance): Promise<void> {
  const { data: utilisateur, error: erreurAuth } = await supabase.auth.getUser();
  if (erreurAuth) throw erreurAuth;
  // Déconnecté : on garde l'état local intact plutôt que de le perdre.
  if (!utilisateur.user) return;

  const { data: log, error: erreurLog } = await supabase
    .from('workout_logs')
    .upsert(
      {
        user_id: utilisateur.user.id,
        session_id: etat.session_id,
        client_uuid: etat.client_uuid,
        date_debut: etat.debut_iso,
        statut: etat.statut,
        date_fin: etat.fin_iso,
        duree_sec: etat.duree_sec,
        volume_total_kg: etat.statut === 'termine' ? volumeLocal(etat) : null,
      },
      { onConflict: 'client_uuid' },
    )
    .select('id')
    .single();

  if (erreurLog) throw erreurLog;

  const { aEcrire, aSupprimer } = aPousser(etat);

  if (aEcrire.length > 0) {
    const { error } = await supabase.from('set_logs').upsert(
      aEcrire.map((s) => ({
        workout_log_id: log.id as string,
        exercise_id: s.exercise_id,
        serie: s.serie,
        reps: s.valeurs.reps,
        charge_kg: s.valeurs.charge_kg,
        rpe: s.valeurs.rpe,
        completed_at: s.valeurs.completed_at,
      })),
      { onConflict: 'workout_log_id,exercise_id,serie' },
    );
    if (error) throw error;
  }

  for (const cle of aSupprimer) {
    const { exercise_id, serie } = decoderCle(cle);
    const { error } = await supabase
      .from('set_logs')
      .delete()
      .eq('workout_log_id', log.id as string)
      .eq('exercise_id', exercise_id)
      .eq('serie', serie);
    if (error) throw error;
  }

  // Relu, et non repris du cliché d'avant : une série a pu être validée
  // pendant que les appels réseau tournaient.
  const frais = await lireEtat(etat.client_uuid);
  if (!frais) return;

  const restant = apresFlush(frais, aSupprimer);
  const pousse = new Set(aEcrire.map((s) => `${s.exercise_id}:${s.serie}`));
  const toutPousse = Object.keys(restant.series).every((cle) => pousse.has(cle));

  // La clé locale ne disparaît qu'une fois la séance close *et* entièrement
  // arrivée en base : c'est la seule chose qui garantit qu'on ne jette rien.
  if (restant.statut === 'termine' && toutPousse) {
    await AsyncStorage.removeItem(PREFIXE_SEANCE + restant.client_uuid);
  } else {
    await ecrireEtat(restant);
  }
}

/**
 * Efface tout l'état de séance local : les séances en attente et le cache du
 * prescrit.
 *
 * Appelé à la déconnexion, et c'est le seul endroit qui en a besoin : changer
 * de compte sur l'appareil passe forcément par là. Sans cette purge, les clés
 * `seance.*` survivent à `signOut()` et le compte suivant les reprend à son
 * compte, au sens propre — une séance jamais synchronisée serait insérée sous
 * son `user_id`, la RLS l'autorisant puisque `user_id` vaut alors `auth.uid()`.
 *
 * À appeler après une dernière `synchroniser()` et avant `signOut()` : c'est
 * la seule fenêtre où la session encore valide permet de sauver ce qui peut
 * l'être avant d'effacer.
 */
export async function oublierSeancesLocales(): Promise<void> {
  const cles = (await AsyncStorage.getAllKeys()).filter(
    (c) => c.startsWith(PREFIXE_SEANCE) || c.startsWith(PREFIXE_PRESCRIT),
  );
  if (cles.length > 0) await AsyncStorage.multiRemove(cles);
}

let flushEnCours = false;
let flushRedemande = false;

/**
 * Vide la file locale vers Supabase. Ne rejette jamais.
 *
 * Appelée sans `await` après chaque écriture, au retour de l'app au premier
 * plan, et au démarrage (`_layout.tsx`) pour les séances laissées par un
 * lancement précédent. Hors ligne, chaque tentative échoue et l'état local
 * reste tel quel — c'est le comportement voulu, pas une erreur à remonter.
 *
 * ponytail: pas de NetInfo, l'échec de l'appel *est* la détection. Ajouter la
 * dépendance si les tentatives perdues deviennent coûteuses.
 */
export async function synchroniser(): Promise<void> {
  if (flushEnCours) {
    // Une écriture est arrivée pendant le flush : on refera un tour.
    flushRedemande = true;
    return;
  }
  flushEnCours = true;
  try {
    do {
      flushRedemande = false;
      for (const etat of await tousLesEtats()) {
        try {
          await pousser(etat);
        } catch {
          // Hors ligne, ou erreur serveur : l'état local attend le prochain tour.
        }
      }
    } while (flushRedemande);
  } finally {
    flushEnCours = false;
  }
}

/* ------------------------------------------------------------------ *
 * Écriture du réalisé
 * ------------------------------------------------------------------ */

type LigneReprise = {
  client_uuid: string | null;
  date_debut: string;
  set_logs: { exercise_id: string | null; serie: number; reps: number | null; charge_kg: number | null; rpe: number | null; completed_at: string | null }[];
};

/**
 * Récupère une séance ouverte côté serveur mais absente du stockage local :
 * app réinstallée, ou séance démarrée sur un autre appareil.
 *
 * Ne peut fonctionner qu'en ligne, par nature. Hors ligne on repart d'une
 * séance neuve — au pire un second `workout_logs` pour la même `session_id`,
 * ce que le code d'avant ne gérait pas mieux.
 */
async function reprendreEnLigne(sessionId: string): Promise<EtatSeance | null> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('client_uuid, date_debut, set_logs(exercise_id, serie, reps, charge_kg, rpe, completed_at)')
    .eq('session_id', sessionId)
    .eq('statut', 'en_cours')
    .order('date_debut', { ascending: false })
    .limit(1)
    .maybeSingle<LigneReprise>();

  if (error) throw error;
  if (!data?.client_uuid) return null;

  const etat = nouvelleSeance(sessionId, data.client_uuid, data.date_debut);
  for (const s of data.set_logs) {
    if (!s.exercise_id) continue;
    etat.series[`${s.exercise_id}:${s.serie}`] = {
      reps: s.reps,
      charge_kg: s.charge_kg,
      rpe: s.rpe,
      completed_at: s.completed_at ?? data.date_debut,
    };
  }
  return etat;
}

/**
 * Ouvre la séance, ou reprend celle déjà en cours, et retourne son
 * `client_uuid` — l'identifiant que les autres fonctions attendent.
 *
 * Le local est consulté avant le réseau : c'est ce qui rend la séance
 * démarrable sans aucune connexion. Reprendre plutôt que recréer, sinon l'app
 * tuée en pleine séance rouvrirait un second `workout_logs` et les séries
 * déjà validées seraient orphelines.
 */
export async function demarrerSeance(sessionId: string): Promise<string> {
  const local = await etatPourSession(sessionId);
  if (local?.statut === 'en_cours') {
    void synchroniser();
    return local.client_uuid;
  }

  let etat: EtatSeance | null = null;
  try {
    etat = await reprendreEnLigne(sessionId);
  } catch {
    // Hors ligne : on démarre une séance neuve.
  }

  const seance = etat ?? nouvelleSeance(sessionId, uuidClient(), new Date().toISOString());
  await ecrireEtat(seance);
  void synchroniser();
  return seance.client_uuid;
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
 * Local d'abord, réseau ensuite et sans attendre : valider une série est
 * instantané à l'écran, avec ou sans connexion. La seule erreur qui peut
 * encore remonter est l'absence d'état local, c'est-à-dire un bug d'appel.
 */
export async function enregistrerSerie(
  clientUuid: string,
  serie: SerieRealisee,
): Promise<void> {
  const etat = await lireEtat(clientUuid);
  if (!etat) throw new Error('Séance locale introuvable.');

  await ecrireEtat(
    poserSerie(etat, serie.exercise_id, serie.serie, {
      reps: serie.reps,
      charge_kg: serie.charge_kg,
      rpe: serie.rpe,
      completed_at: new Date().toISOString(),
    }),
  );
  void synchroniser();
}

/** Dévalider une série la retire du réalisé — sinon elle compterait au volume. */
export async function supprimerSerie(
  clientUuid: string,
  exerciseId: string,
  serie: number,
): Promise<void> {
  const etat = await lireEtat(clientUuid);
  if (!etat) throw new Error('Séance locale introuvable.');

  await ecrireEtat(retirerSerie(etat, exerciseId, serie));
  void synchroniser();
}

/**
 * Clôt la séance et retourne le volume.
 *
 * Le volume vient de l'état local et non d'une relecture de `set_logs` : hors
 * ligne il n'y a rien à relire, et l'état local porte de toute façon aussi
 * bien les séries déjà synchronisées que celles qui attendent.
 */
export async function terminerSeance(clientUuid: string, dureeSec: number): Promise<number> {
  const etat = await lireEtat(clientUuid);
  if (!etat) throw new Error('Séance locale introuvable.');

  const close = cloturerSeance(etat, dureeSec, new Date().toISOString());
  await ecrireEtat(close);
  void synchroniser();
  return volumeLocal(close);
}

/**
 * Le statut réel d'une séance, pour un écran qui ne la démarre pas encore.
 *
 * Le local passe avant le réseau, sinon le détail de séance (B3) serait cassé
 * hors ligne alors que la séance derrière est parfaitement jouable. Une séance
 * close localement mais pas encore synchronisée compte comme terminée : elle
 * l'est, du point de vue de l'utilisateur.
 */
export async function statutSeance(
  sessionId: string,
): Promise<'termine' | 'en_cours' | 'a_venir'> {
  const local = await etatPourSession(sessionId);
  if (local?.statut === 'termine') return 'termine';

  try {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('statut')
      .eq('session_id', sessionId)
      .returns<{ statut: string | null }[]>();

    if (error) throw error;

    const statuts = (data ?? []).map((l) => l.statut);
    if (statuts.includes('termine')) return 'termine';
    if (statuts.includes('en_cours') || local) return 'en_cours';
    return 'a_venir';
  } catch {
    return local ? 'en_cours' : 'a_venir';
  }
}
