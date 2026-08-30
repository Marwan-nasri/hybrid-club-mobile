/**
 * Vérification du calcul de l'onglet Progression.
 *
 *   npm run test:progression
 *
 * Pas de framework : des assertions, et le script sort en erreur si une casse.
 * Ce qu'on vérifie surtout, c'est ce qui doit rester *absent* faute de données —
 * la variation en % ne doit pas apparaître sur un historique trop court.
 */

import assert from 'node:assert/strict';

import { numeroSemaineIso } from '../src/lib/calendrier.ts';
import { agreger, debutPeriode, libellePerf, libelleVolume } from '../src/lib/progressionCalcul.ts';

import type { LigneSet } from '../src/lib/progressionCalcul.ts';

/** Jeudi 27 août 2026, 14 h. La semaine en cours démarre le lundi 24. */
const AUJOURDHUI = new Date(2026, 7, 27, 14, 0);

const serie = (jour: Date, exercice: string, reps: number, charge: number): LigneSet => ({
  exercise_id: exercice,
  reps,
  charge_kg: charge,
  completed_at: jour.toISOString(),
  exercises: { nom: exercice === 'squat' ? 'Back squat' : 'Développé couché' },
});

const jour = (mois: number, j: number, h = 18) => new Date(2026, mois - 1, j, h, 0);

// ── La fenêtre ───────────────────────────────────────────────────────────────

const debut = debutPeriode('6sem', AUJOURDHUI);
assert.equal(debut.getDate(), 20, '6 semaines = les 5 précédentes + la courante');
assert.equal(debut.getMonth(), 6, 'lundi 20 juillet 2026');
assert.equal(debutPeriode('1an', AUJOURDHUI).getFullYear(), 2025, '52 semaines remontent d’un an');
console.log('  ok  la période se compte en semaines calendaires, lundi → lundi');

// ── Le cas du nouvel utilisateur : une seule semaine de données ──────────────

const debutant = agreger(
  [
    serie(jour(8, 24), 'squat', 5, 100), //  500 kg
    serie(jour(8, 24), 'squat', 5, 100), //  500 kg
    serie(jour(8, 26), 'bench', 8, 60), //   480 kg
  ],
  debut,
  AUJOURDHUI,
  6,
);

assert.equal(debutant.volume_kg, 1480, 'volume = somme des reps × charge');
assert.equal(
  debutant.variation,
  null,
  'une seule semaine, et elle est en cours : aucune variation à afficher',
);
assert.equal(debutant.semaines.length, 6, 'six colonnes, même vides');
assert.deepEqual(
  debutant.semaines.map((s) => s.volume_kg),
  [0, 0, 0, 0, 0, 1480],
  'les semaines sans séance restent à zéro, elles ne sont pas comblées',
);
assert.deepEqual(
  debutant.exercices.map((e) => e.nom),
  ['Développé couché', 'Back squat'],
  'exercices triés par date de dernière séance, la plus récente en tête',
);
assert.deepEqual(
  { charge: debutant.exercices[0].charge_kg, reps: debutant.exercices[0].reps },
  { charge: 60, reps: 8 },
  'la dernière performance loggée, brute',
);
console.log('  ok  peu de données : volume seul, pas de pourcentage inventé');

// ── Deux semaines pleines : la variation devient légitime ────────────────────

const compare = agreger(
  [
    // Période précédente (semaines du 8 au 15 juin), pour le dénominateur.
    serie(jour(6, 9), 'squat', 5, 100), // 500
    serie(jour(6, 16), 'squat', 5, 100), // 500
    // Deux semaines pleines dans la période, plus la semaine en cours.
    serie(jour(8, 4), 'squat', 5, 110), // 550
    serie(jour(8, 11), 'squat', 5, 110), // 550
    serie(jour(8, 25), 'squat', 5, 120), // 600
  ],
  debut,
  AUJOURDHUI,
  6,
);

assert.equal(compare.volume_kg, 1700, 'seules les séries de la période comptent');
assert.ok(compare.variation !== null, 'deux semaines pleines : la variation s’affiche');
assert.equal(Math.round(compare.variation! * 1000) / 1000, 0.7, '1 700 vs 1 000 = +70 %');
console.log('  ok  variation affichée dès deux semaines pleines de données');

// La semaine en cours ne compte pas comme « pleine » : sans elle, il n'en reste
// qu'une, et le pourcentage doit disparaître.
const uneSeulePleine = agreger(
  [
    serie(jour(6, 9), 'squat', 5, 100),
    serie(jour(8, 11), 'squat', 5, 110),
    serie(jour(8, 25), 'squat', 5, 120),
  ],
  debut,
  AUJOURDHUI,
  6,
);
assert.equal(uneSeulePleine.variation, null, 'la semaine en cours n’est pas une semaine pleine');
console.log('  ok  la semaine en cours ne débloque pas la variation à elle seule');

// ── Numéro de semaine ISO, pour les libellés du graphique ────────────────────

assert.equal(numeroSemaineIso(new Date(2026, 7, 24)), 35, 'lundi 24 août 2026 = S35');
assert.equal(numeroSemaineIso(new Date(2026, 0, 1)), 1, '1er janvier 2026 (jeudi) = S1');
assert.equal(numeroSemaineIso(new Date(2027, 0, 1)), 53, '1er janvier 2027 (vendredi) = S53 de 2026');
console.log('  ok  numéro de semaine ISO');

// ── Mise en forme ────────────────────────────────────────────────────────────

assert.equal(libelleVolume(12_400), '12,4 t', 'tonnes, virgule décimale');
assert.equal(libelleVolume(0), '0 t', 'pas de « 0,0 t »');
assert.equal(libellePerf(92.5, 6), '92,5 kg × 6', 'demi-kilos conservés');
assert.equal(libellePerf(100, 5), '100 kg × 5', 'pas de décimale inutile');
assert.equal(libellePerf(null, 12), '12 reps', 'poids de corps : pas de charge');
console.log('  ok  mise en forme des chiffres');

console.log('\n16 vérifications passées.');
