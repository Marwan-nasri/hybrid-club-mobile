/**
 * Vérification de l'état local d'une séance.
 *
 *   npm run test:seance-offline
 *
 * Pas de framework : des assertions, et le script sort en erreur si une casse.
 * Ce qui se casserait en silence sans ce fichier, c'est la fusion d'après
 * flush — le cas où l'utilisateur valide une série pendant que la
 * synchronisation tourne. Un écrasement par le cliché d'avant perdrait la
 * série sans que rien ne le signale.
 */

import assert from 'node:assert/strict';

import {
  apresFlush,
  aPousser,
  cleSerie,
  cloturerSeance,
  decoderCle,
  nouvelleSeance,
  poserSerie,
  retirerSerie,
  volumeLocal,
} from '../src/lib/seanceLocale.ts';

import type { EtatSeance } from '../src/lib/seanceLocale.ts';

const SQUAT = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const DC = '9a8b7c6d-5e4f-4321-8765-4a3b2c1d0e9f';
const DEBUT = '2026-08-30T18:00:00.000Z';

const valeurs = (reps: number, charge: number, quand = DEBUT) => ({
  reps,
  charge_kg: charge,
  rpe: 8,
  completed_at: quand,
});

function seanceDeBase(): EtatSeance {
  let etat = nouvelleSeance('session-1', 'uuid-client-1', DEBUT);
  etat = poserSerie(etat, SQUAT, 1, valeurs(6, 100));
  etat = poserSerie(etat, SQUAT, 2, valeurs(6, 102.5));
  etat = poserSerie(etat, DC, 1, valeurs(8, 80));
  return etat;
}

// --- La clé encode un uuid sans l'abîmer ---------------------------------
assert.deepEqual(decoderCle(cleSerie(SQUAT, 3)), { exercise_id: SQUAT, serie: 3 });

// --- Volume : les pierres tombales ne comptent pas ------------------------
const base = seanceDeBase();
assert.equal(volumeLocal(base), 6 * 100 + 6 * 102.5 + 8 * 80);

const sansDeuxieme = retirerSerie(base, SQUAT, 2);
assert.equal(
  volumeLocal(sansDeuxieme),
  6 * 100 + 8 * 80,
  'une série dévalidée ne doit plus peser au volume',
);

// --- Répartition écriture / suppression ----------------------------------
const { aEcrire, aSupprimer } = aPousser(sansDeuxieme);
assert.equal(aEcrire.length, 2);
assert.deepEqual(aSupprimer, [cleSerie(SQUAT, 2)]);
assert.deepEqual(
  aEcrire.map((s) => `${s.exercise_id}:${s.serie}`).sort(),
  [cleSerie(DC, 1), cleSerie(SQUAT, 1)].sort(),
);

// --- Une série validée pendant le flush ne doit pas être écrasée ----------
// Le flush part du cliché `sansDeuxieme` ; entre-temps l'utilisateur valide
// la 3e série de squat. C'est `frais` qui fait foi au moment de réécrire.
const frais = poserSerie(sansDeuxieme, SQUAT, 3, valeurs(5, 105, '2026-08-30T18:12:00.000Z'));
const restant = apresFlush(frais, aSupprimer);

assert.ok(
  cleSerie(SQUAT, 3) in restant.series,
  'la série validée pendant le flush doit survivre à la réécriture',
);
assert.ok(
  !(cleSerie(SQUAT, 2) in restant.series),
  'la pierre tombale poussée doit être purgée',
);
assert.equal(Object.keys(restant.series).length, 3);

// --- Une série revalidée pendant le flush garde sa place ------------------
// Le `delete` est déjà parti côté serveur : la série doit être repoussée au
// tour suivant, donc rester dans l'état local.
const revalidee = poserSerie(sansDeuxieme, SQUAT, 2, valeurs(6, 95));
const apresRevalidation = apresFlush(revalidee, aSupprimer);
assert.deepEqual(
  apresRevalidation.series[cleSerie(SQUAT, 2)],
  valeurs(6, 95),
  'une série revalidée pendant le flush ne doit pas être purgée avec sa tombe',
);

// --- Clôture --------------------------------------------------------------
const close = cloturerSeance(base, 3720, '2026-08-30T19:02:00.000Z');
assert.equal(close.statut, 'termine');
assert.equal(close.duree_sec, 3720);
assert.equal(close.fin_iso, '2026-08-30T19:02:00.000Z');
assert.equal(close.debut_iso, DEBUT, 'le début ne bouge pas : le chrono s\'y raccroche');

// --- Rejouer un flush complet est sans effet ------------------------------
// Deuxième passe sur un état déjà poussé : plus rien à supprimer, et les
// mêmes séries à écrire — les contraintes uniques en base absorbent le doublon.
const rejoue = aPousser(restant);
assert.deepEqual(rejoue.aSupprimer, []);
assert.equal(rejoue.aEcrire.length, 3);

console.log('OK — état local de séance');
