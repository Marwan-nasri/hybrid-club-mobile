/**
 * Vérification du placement semaine/jour.
 *
 *   npm run test:calendrier
 *
 * Pas de framework : des assertions, et le script sort en erreur si une casse.
 * Ce qu'on vérifie surtout, c'est que la semaine se compte en semaines
 * calendaires (lundi → dimanche) et pas en jours écoulés depuis `date_debut`.
 */

import assert from 'node:assert/strict';

import { jourIso, semaineEtJour } from '../src/lib/calendrier.ts';

const cas: [string, string, number, number, string][] = [
  // date_debut, jour observé, semaine attendue, jour attendu, ce qu'on teste
  ['2026-08-24', '2026-08-24', 1, 1, 'lundi de départ = S1 J1'],
  ['2026-08-24', '2026-08-30', 1, 7, 'dimanche de la même semaine reste en S1'],
  ['2026-08-24', '2026-08-31', 2, 1, 'le lundi suivant bascule en S2'],

  // Le cas qui casse un calcul en « jours écoulés » : compte créé un mercredi.
  ['2026-08-26', '2026-08-26', 1, 3, 'départ un mercredi = S1 J3, pas S1 J1'],
  ['2026-08-26', '2026-08-24', 1, 1, 'le lundi précédant date_debut est déjà S1'],
  ['2026-08-26', '2026-08-31', 2, 1, 'S2 démarre au lundi suivant, pas 7 jours après'],

  // Passage à l'heure d'hiver en France : nuit du 25 au 26 octobre 2026.
  ['2026-10-19', '2026-10-26', 2, 1, 'changement d’heure : la semaine avance quand même'],
  ['2026-10-19', '2026-11-02', 3, 1, 'changement d’heure : pas de semaine perdue ensuite'],

  ['2026-08-24', '2026-11-09', 12, 1, 'dernière semaine du bloc'],
];

for (const [debut, observe, semaine, jour, libelle] of cas) {
  const [a, m, j] = observe.split('-').map(Number);
  const resultat = semaineEtJour(debut, new Date(a, m - 1, j, 14, 30));
  assert.deepEqual(resultat, { semaine, jour }, `${libelle} — reçu ${JSON.stringify(resultat)}`);
  console.log(`  ok  S${semaine} J${jour}  ${libelle}`);
}

// getDay() de JS met dimanche à 0 : l'erreur classique est un décalage d'un cran.
assert.equal(jourIso(new Date(2026, 7, 30)), 7, 'dimanche doit valoir 7, pas 0');
assert.equal(jourIso(new Date(2026, 7, 24)), 1, 'lundi doit valoir 1');
console.log('  ok  jourIso : dimanche = 7, lundi = 1');

console.log(`\n${cas.length + 1} vérifications passées.`);
