/**
 * L'état local d'une séance en cours, et ses transitions.
 *
 * Sans AsyncStorage ni Supabase — d'où le fichier séparé, comme
 * `progressionCalcul.ts` : `npm run test:seance-offline` l'importe dans node,
 * où ni le client Supabase ni AsyncStorage ne se chargent. La persistance et
 * la synchronisation vivent dans `seanceLive.ts`.
 *
 * La clé de voûte est le `client_uuid` : généré ici, il identifie la séance
 * du côté de l'app, là où l'`id` de `workout_logs` n'existe qu'une fois la
 * première synchronisation passée. Tout le chemin d'écriture est donc jouable
 * hors ligne, et la résolution `client_uuid` → `id` serveur n'arrive qu'au
 * moment du flush, via la contrainte unique de la colonne.
 */

/** Une série validée. `completed_at` vient du client : c'est le seul horodatage disponible hors ligne. */
export type SerieLocale = {
  reps: number | null;
  charge_kg: number | null;
  rpe: number | null;
  completed_at: string;
};

export type EtatSeance = {
  session_id: string;
  client_uuid: string;
  /** ISO. Fait foi pour le chrono, y compris après un redémarrage de l'app. */
  debut_iso: string;
  statut: 'en_cours' | 'termine';
  /** ISO, posé à la clôture. Pas au flush : celui-ci peut arriver des jours plus tard. */
  fin_iso: string | null;
  duree_sec: number | null;
  /**
   * Clé `<exercise_id>:<serie>`. Une valeur `null` est une pierre tombale :
   * la série a été dévalidée et doit être supprimée en base si elle y est
   * déjà arrivée. Purgée une fois la suppression passée.
   */
  series: Record<string, SerieLocale | null>;
};

/** Le `client_uuid` ne sert qu'à dédupliquer une reprise : pas un secret. */
export function uuidClient(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 0x3) | 0x8).toString(16);
  });
}

/** Un `exercise_id` est un uuid : jamais de `:`, la clé se décode sans ambiguïté. */
export function cleSerie(exerciseId: string, serie: number): string {
  return `${exerciseId}:${serie}`;
}

export function decoderCle(cle: string): { exercise_id: string; serie: number } {
  const separateur = cle.lastIndexOf(':');
  return {
    exercise_id: cle.slice(0, separateur),
    serie: Number(cle.slice(separateur + 1)),
  };
}

export function nouvelleSeance(
  sessionId: string,
  clientUuid: string,
  debutIso: string,
): EtatSeance {
  return {
    session_id: sessionId,
    client_uuid: clientUuid,
    debut_iso: debutIso,
    statut: 'en_cours',
    fin_iso: null,
    duree_sec: null,
    series: {},
  };
}

export function poserSerie(
  etat: EtatSeance,
  exerciseId: string,
  serie: number,
  valeurs: SerieLocale,
): EtatSeance {
  return { ...etat, series: { ...etat.series, [cleSerie(exerciseId, serie)]: valeurs } };
}

/**
 * Dévalide une série.
 *
 * On pose une pierre tombale plutôt que d'effacer la clé : la série est
 * peut-être déjà en base, et rien côté client ne permet de le savoir. Le
 * `delete` qui en découle est sans effet si elle n'y était pas.
 */
export function retirerSerie(etat: EtatSeance, exerciseId: string, serie: number): EtatSeance {
  return { ...etat, series: { ...etat.series, [cleSerie(exerciseId, serie)]: null } };
}

export function cloturerSeance(
  etat: EtatSeance,
  dureeSec: number,
  finIso: string,
): EtatSeance {
  return { ...etat, statut: 'termine', fin_iso: finIso, duree_sec: dureeSec };
}

/**
 * Le volume, calculé sur l'état local.
 *
 * C'était jusqu'ici une relecture de `set_logs` — « la base fait foi ». Hors
 * ligne il n'y a pas de base, et l'état local est désormais la source de
 * vérité de la séance en cours : il porte aussi bien les séries déjà
 * synchronisées que celles qui attendent.
 */
export function volumeLocal(etat: EtatSeance): number {
  return Object.values(etat.series).reduce(
    (total, s) => total + (s ? (s.reps ?? 0) * (s.charge_kg ?? 0) : 0),
    0,
  );
}

/** Ce qu'il reste à pousser : les séries à écrire, et les clés à supprimer. */
export function aPousser(etat: EtatSeance): {
  aEcrire: { exercise_id: string; serie: number; valeurs: SerieLocale }[];
  aSupprimer: string[];
} {
  const aEcrire: { exercise_id: string; serie: number; valeurs: SerieLocale }[] = [];
  const aSupprimer: string[] = [];
  for (const [cle, valeurs] of Object.entries(etat.series)) {
    if (valeurs) aEcrire.push({ ...decoderCle(cle), valeurs });
    else aSupprimer.push(cle);
  }
  return { aEcrire, aSupprimer };
}

/**
 * L'état à réécrire une fois le flush passé.
 *
 * `frais` est relu après les appels réseau, pas repris du cliché d'avant :
 * l'utilisateur a pu valider une série pendant que la synchronisation
 * tournait, et l'écraser avec l'ancien état la perdrait.
 *
 * Une pierre tombale n'est purgée que si elle en est toujours une. Si la série
 * a été revalidée entre-temps, on la garde — elle vient d'être supprimée en
 * base et le prochain flush la réécrira.
 */
export function apresFlush(frais: EtatSeance, cleSupprimees: string[]): EtatSeance {
  const series = { ...frais.series };
  for (const cle of cleSupprimees) {
    if (series[cle] === null) delete series[cle];
  }
  return { ...frais, series };
}
