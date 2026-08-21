import bundle from './exercises.generated.json';

import type { Exercise, Substitution } from './programGenerator';

/**
 * Catalogue embarqué, généré depuis supabase/migrations/ par `npm run build:catalogue`.
 * Embarqué plutôt que lu en base parce que le reveal et le paywall sont
 * pré-authentification, et que la RLS de `exercises` exige un utilisateur connecté.
 */
export const EXERCISES = bundle.exercises as unknown as Exercise[];
export const SUBSTITUTIONS = bundle.substitutions as unknown as Substitution[];

/** slug → nom affichable, pour ne jamais montrer « back-squat » à l'écran. */
export const NOM_EXERCICE = new Map(EXERCISES.map((e) => [e.slug, e.nom]));
