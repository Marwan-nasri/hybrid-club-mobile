import { EXERCISES, SUBSTITUTIONS } from './catalogue';
import { generateProgram } from './programGenerator';
import { TEMPLATES } from './templates';

import type { GeneratedProgram, GeneratorProfile } from './programGenerator';

/**
 * Génère le programme d'un profil à partir des données embarquées.
 * Point d'entrée unique de l'app : les écrans n'appellent jamais
 * generateProgram directement, et l'insertion Supabase se branchera ici.
 */
export function genererProgramme(profile: GeneratorProfile): GeneratedProgram {
  return generateProgram({
    profile,
    templates: TEMPLATES,
    exercises: EXERCISES,
    substitutions: SUBSTITUTIONS,
  });
}
