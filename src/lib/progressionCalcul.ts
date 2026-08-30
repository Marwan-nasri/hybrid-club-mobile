import { lundiDe, numeroSemaineIso } from './calendrier.ts';

/**
 * Le calcul de l'onglet Progression (B8), sans Supabase — d'où le fichier
 * séparé : `npm run test:progression` l'importe dans node, où le client
 * Supabase (AsyncStorage) ne se charge pas.
 *
 * Tout vient de `set_logs` — le réalisé, jamais le prescrit. Ce qui n'a pas de
 * donnée derrière est absent plutôt qu'à zéro :
 *
 * - pas d'allure moyenne : `cardio_logs` n'est écrit par personne ;
 * - pas de record ni de 1RM estimé : la méthode de calcul reste à décider, on
 *   n'affiche que la dernière performance brute.
 */

/** Les trois fenêtres du sélecteur B8, en semaines calendaires. */
export type Periode = '6sem' | '3mois' | '1an';

export const SEMAINES_PERIODE: Record<Periode, number> = { '6sem': 6, '3mois': 13, '1an': 52 };

export const LIBELLE_PERIODE: Record<Periode, string> = {
  '6sem': '6 sem.',
  '3mois': '3 mois',
  '1an': '1 an',
};

export type SemaineVolume = {
  /** Minuit local du lundi de la semaine. */
  lundi: Date;
  /** « S27 » — numéro ISO, comme sur la maquette. */
  label: string;
  volume_kg: number;
};

export type ExerciceTravaille = {
  exercise_id: string;
  nom: string;
  derniere: Date;
  charge_kg: number | null;
  reps: number | null;
};

export type Progression = {
  volume_kg: number;
  /**
   * Écart avec la période précédente de même durée, en fraction (0,062 = +6,2 %).
   * `null` tant qu'il n'y a pas de quoi la calculer honnêtement.
   */
  variation: number | null;
  /** `null` sans programme actif : l'assiduité n'a alors pas de dénominateur. */
  seances: { total: number; terminees: number } | null;
  semaines: SemaineVolume[];
  exercices: ExerciceTravaille[];
};

export type LigneSet = {
  exercise_id: string | null;
  reps: number | null;
  charge_kg: number | null;
  completed_at: string;
  exercises: { nom: string } | null;
};

/** Le lundi de la première semaine de la fenêtre, qui se termine cette semaine. */
export function debutPeriode(periode: Periode, aujourdhui: Date): Date {
  const lundi = lundiDe(aujourdhui);
  lundi.setDate(lundi.getDate() - (SEMAINES_PERIODE[periode] - 1) * 7);
  return lundi;
}

/**
 * Le tri des séries en semaines, exercices et volumes. Pur, testable sans base
 * — voir `npm run test:progression`.
 *
 * Les lignes antérieures à `debut` ne servent qu'au volume de la période
 * précédente, d'où la comparaison en pourcentage.
 */
export function agreger(
  lignes: LigneSet[],
  debut: Date,
  aujourdhui: Date,
  nbSemaines: number,
): Omit<Progression, 'seances'> {
  const semaines: SemaineVolume[] = Array.from({ length: nbSemaines }, (_, i) => {
    const lundi = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i * 7);
    return { lundi, label: `S${numeroSemaineIso(lundi)}`, volume_kg: 0 };
  });
  const index = new Map(semaines.map((s, i) => [s.lundi.getTime(), i]));

  const derniers = new Map<string, ExerciceTravaille>();
  let volume = 0;
  let precedent = 0;

  for (const l of lignes) {
    const date = new Date(l.completed_at);
    const kg = (l.reps ?? 0) * Number(l.charge_kg ?? 0);

    if (date < debut) {
      precedent += kg;
      continue;
    }

    volume += kg;
    const i = index.get(lundiDe(date).getTime());
    if (i !== undefined) semaines[i].volume_kg += kg;

    if (!l.exercise_id) continue;
    const connu = derniers.get(l.exercise_id);
    if (!connu || date > connu.derniere) {
      derniers.set(l.exercise_id, {
        exercise_id: l.exercise_id,
        nom: l.exercises?.nom ?? 'Exercice',
        derniere: date,
        charge_kg: l.charge_kg === null ? null : Number(l.charge_kg),
        reps: l.reps,
      });
    }
  }

  // Une semaine « pleine » est une semaine entièrement écoulée : la semaine en
  // cours ne compte pas, sinon un lundi matin ferait chuter le pourcentage.
  const lundiCourant = lundiDe(aujourdhui).getTime();
  const pleines = semaines.filter(
    (s) => s.volume_kg > 0 && s.lundi.getTime() < lundiCourant,
  ).length;

  return {
    volume_kg: volume,
    variation: pleines >= 2 && precedent > 0 ? volume / precedent - 1 : null,
    semaines,
    exercices: [...derniers.values()].sort((a, b) => b.derniere.getTime() - a.derniere.getTime()),
  };
}

// ── Mise en forme ────────────────────────────────────────────────────────────

const MOIS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** « 2 sept. » — Intl n'est pas garanti sur Hermes, la table suffit. */
export function libelleDate(d: Date): string {
  return `${d.getDate()} ${MOIS[d.getMonth()]}`;
}

const virgule = (n: number, decimales: number) => n.toFixed(decimales).replace('.', ',');

/** « 12,4 t » — le volume est toujours en tonnes, comme sur la maquette B8. */
export function libelleVolume(kg: number): string {
  return kg === 0 ? '0 t' : `${virgule(kg / 1000, 1)} t`;
}

/** « 6,2 % », depuis une fraction. */
export function pourcent(fraction: number): string {
  return `${virgule(fraction * 100, 1)} %`;
}

/** « 95 kg × 6 », ou « 6 reps » sur un mouvement au poids de corps. */
export function libellePerf(charge_kg: number | null, reps: number | null): string {
  if (charge_kg === null || charge_kg === 0) {
    return reps === null ? '—' : `${reps} rep${reps > 1 ? 's' : ''}`;
  }
  const kg = virgule(charge_kg, charge_kg % 1 === 0 ? 0 : 1);
  return reps === null ? `${kg} kg` : `${kg} kg × ${reps}`;
}
