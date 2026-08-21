/**
 * Génère le catalogue embarqué dans l'app depuis les migrations SQL.
 *
 *   npm run build:catalogue
 *
 * A6 (reveal) et A7 (paywall) sont pré-authentification : la RLS de `exercises`
 * est ouverte aux seuls utilisateurs authentifiés, et un aller-retour réseau
 * juste avant le paywall serait un point de friction au pire endroit du funnel.
 * Le catalogue est donc embarqué, comme les templates de niveau.
 *
 * À relancer à chaque modification du seed dans supabase/migrations/.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { lireSeed } from './seed-parser.ts';

const RACINE = join(import.meta.dirname, '..');
const CIBLE = join(RACINE, 'src', 'lib', 'exercises.generated.json');

const seed = lireSeed(RACINE);

writeFileSync(CIBLE, JSON.stringify(seed, null, 2) + '\n', 'utf8');

console.log(
  `${seed.exercises.length} exercices et ${seed.substitutions.length} substitutions écrits dans ` +
    'src/lib/exercises.generated.json',
);
