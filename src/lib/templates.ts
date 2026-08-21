import avance from '../../moteur-reference/template-niveau-avance.json';
import debutant from '../../moteur-reference/template-niveau-debutant.json';
import intermediaire from '../../moteur-reference/template-niveau-intermediaire.json';

import type { LevelTemplate, LevelType } from './programGenerator';

/**
 * Les 3 templates de niveau, importés statiquement pour que Metro les embarque.
 *
 * Le double cast est nécessaire : TypeScript infère les champs d'un JSON en
 * types larges (`string` au lieu des unions de littéraux du schéma). La forme
 * réelle est vérifiée par le script scripts/test-program-generator.ts.
 */
export const TEMPLATES: Record<LevelType, LevelTemplate> = {
  debutant: debutant as unknown as LevelTemplate,
  intermediaire: intermediaire as unknown as LevelTemplate,
  avance: avance as unknown as LevelTemplate,
};
