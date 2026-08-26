/**
 * Placement d'une séance dans le calendrier réel.
 *
 * Deux faits, tirés du code qui a servi à l'insertion, pas d'une convention
 * supposée :
 *
 * 1. `sessions.jour` est un jour de semaine ISO (1 = lundi), pas un décalage
 *    depuis `date_debut`. Voir `CRENEAUX_JOUR` dans programGenerator.ts : un
 *    profil 3 jours reçoit [1, 3, 5], soit lundi/mercredi/vendredi — la
 *    répartition n'a de sens que lue comme des jours de semaine.
 *
 * 2. `date_debut` n'est jamais écrit par `creer_programme` (migration 006) :
 *    la colonne retombe sur son défaut `current_date` (migration 001), donc
 *    sur le jour de création du compte, qui n'a aucune raison d'être un lundi.
 *
 * D'où la règle : la semaine N est la N-ième semaine calendaire lundi →
 * dimanche à partir de celle qui contient `date_debut`. On ne compte pas en
 * « jours écoulés depuis date_debut », ce qui décalerait tout le programme dès
 * qu'un compte est créé un autre jour que lundi.
 *
 * Corollaire assumé : un compte créé un mercredi démarre en semaine 1 avec les
 * séances de lundi et mardi déjà derrière lui. C'est le comportement le moins
 * surprenant tant que `date_debut` n'est pas choisi à l'inscription.
 */

const MS_JOUR = 86_400_000;

/** 1 = lundi … 7 = dimanche, depuis `getDay()` de JS où 0 = dimanche. */
export function jourIso(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

/** Minuit local du lundi de la semaine de `d`. */
function lundiDe(d: Date): Date {
  const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  lundi.setDate(lundi.getDate() - (jourIso(d) - 1));
  return lundi;
}

/**
 * `date_debut` est une colonne `date` : elle arrive en « YYYY-MM-DD ».
 * `new Date(s)` la lirait comme minuit UTC et reculerait d'un jour à l'ouest
 * de Greenwich — on la construit en heure locale.
 */
function parseDateLocale(iso: string): Date {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j);
}

export function semaineEtJour(dateDebut: string, aujourdhui: Date): { semaine: number; jour: number } {
  const ecart = lundiDe(aujourdhui).getTime() - lundiDe(parseDateLocale(dateDebut)).getTime();
  // `round` et non `floor` : les deux bornes sont des minuits locaux, donc
  // séparées d'un multiple exact de 7 jours à ±1 h près au passage à l'heure
  // d'hiver. `floor` perdrait une semaine entière sur cette heure-là.
  return { semaine: Math.round(ecart / MS_JOUR / 7) + 1, jour: jourIso(aujourdhui) };
}
