/**
 * Audit de couverture des substitutions : toutes les zones × tous les exercices
 * utilisés par les 3 templates de niveau.
 *
 *   npm run audit:substitutions
 *
 * L'audit passe par generateProgram plutôt que de réimplémenter la sélection :
 * il mesure le comportement réel du moteur, pas une copie qui pourrait diverger.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateProgram } from '../src/lib/programGenerator.ts';
import type { BodyZone, LevelTemplate, LevelType } from '../src/lib/programGenerator.ts';
import { lireSeed } from './seed-parser.ts';

const RACINE = join(import.meta.dirname, '..');

const ZONES: BodyZone[] = ['epaule', 'coude', 'poignet', 'dos_bas', 'hanche', 'genou', 'cheville'];
const NIVEAUX: LevelType[] = ['debutant', 'intermediaire', 'avance'];

const { exercises, substitutions } = lireSeed(RACINE);
const catalogue = new Map(exercises.map((e) => [e.slug, e]));

const templates = Object.fromEntries(
  NIVEAUX.map((n) => [
    n,
    JSON.parse(
      readFileSync(join(RACINE, 'moteur-reference', `template-niveau-${n}.json`), 'utf8'),
    ) as LevelTemplate,
  ]),
) as Record<LevelType, LevelTemplate>;

/** Tous les slugs prescrits par au moins un template. */
const utilises = new Set<string>();
for (const t of Object.values(templates)) {
  for (const jour of t.pool_jours) {
    for (const bloc of jour.blocs_semaine_1) {
      if (bloc.exercise_slug) utilises.add(bloc.exercise_slug);
    }
  }
}

console.log(
  `Catalogue : ${exercises.length} exercices, ${substitutions.length} substitutions.\n` +
    `Prescrits par les 3 templates : ${utilises.size} exercices.\n`,
);

let totalTrous = 0;
let totalPartiels = 0;

for (const zone of ZONES) {
  // jours_dispo 6 = le pool complet, salle_complete = aucune interférence équipement.
  const trous = new Map<string, string>();
  const partiels = new Map<string, string>();

  for (const niveau of NIVEAUX) {
    const resultat = generateProgram({
      profile: {
        objectif: 'hyrox',
        niveau,
        jours_dispo: 6,
        equipement: 'salle_complete',
        limitations: [zone],
        squat_1rm: 140,
        bench_1rm: 100,
        deadlift_1rm: 180,
      },
      templates,
      exercises,
      substitutions,
    });

    for (const w of resultat.warnings) {
      if (w.code === 'substitut_introuvable') trous.set(w.exercise_slug, w.message);
      if (w.code === 'substitut_toujours_contre_indique') partiels.set(w.exercise_slug, w.message);
    }
  }

  const concernes = [...utilises].filter((s) => catalogue.get(s)?.zones_sollicitees.includes(zone));
  const couverts = concernes.length - trous.size - partiels.size;
  totalTrous += trous.size;
  totalPartiels += partiels.size;

  const etat = trous.size === 0 && partiels.size === 0 ? 'OK' : 'À COMPLÉTER';
  console.log(
    `─ ${zone.toUpperCase()} ─ ${concernes.length} exercice(s) concerné(s) · ` +
      `${couverts} couvert(s), ${partiels.size} partiel(s), ${trous.size} trou(s)  [${etat}]`,
  );

  for (const [slug] of partiels) {
    const ex = catalogue.get(slug);
    console.log(`    partiel : ${slug} (${ex?.nom}) — substitut existant mais toujours contre-indiqué`);
  }
  for (const [slug] of trous) {
    const ex = catalogue.get(slug);
    console.log(`    trou    : ${slug} (${ex?.nom}) — aucun substitut, exercice servi tel quel`);
  }
  if (trous.size === 0 && partiels.size === 0 && concernes.length > 0) {
    console.log('    tous couverts par un substitut sain');
  }
  console.log('');
}

console.log(
  `TOTAL : ${totalPartiels} substitution(s) partielle(s), ${totalTrous} trou(s) sur les 7 zones.`,
);
