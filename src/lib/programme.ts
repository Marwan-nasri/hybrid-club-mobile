import { EXERCISES, SUBSTITUTIONS } from './catalogue';
import { generateProgram } from './programGenerator';
import { effacerProfil, estComplet, lireProfil } from './profilOnboarding';
import { supabase } from './supabase';
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

/**
 * Insère le programme généré dans programs / sessions / session_blocks.
 *
 * Tout part en un seul appel RPC (migration 006) : le client Supabase ne sait
 * pas ouvrir de transaction, la fonction plpgsql en est une. L'user_id vient
 * de auth.uid() côté serveur, il n'est donc pas passé ici.
 *
 * Les slugs sont résolus en uuid dans le SQL — aucune requête préalable sur
 * `exercises`. charge_kg et contre_indication sont dérivés : ignorés à l'insert.
 *
 * @returns l'id du programme créé.
 */
export async function enregistrerProgramme(programme: GeneratedProgram): Promise<string> {
  const payload = { ...programme.program, sessions: programme.sessions };

  // ponytail: 3 tentatives sur erreur réseau. Un timeout après commit côté
  // serveur créerait un doublon — passer par un id généré au client si ça arrive.
  let derniere: unknown;
  for (let tentative = 1; tentative <= 3; tentative++) {
    const { data, error } = await supabase.rpc('creer_programme', { programme: payload });
    if (!error) return data as string;

    derniere = error;
    // `code` renseigné = rejet Postgres (slug inconnu, RLS) : réessayer n'y changera rien.
    if (error.code) break;
    await new Promise((r) => setTimeout(r, 500 * tentative));
  }

  throw derniere;
}

/**
 * Reprend le profil laissé par l'onboarding, régénère le programme et l'insère.
 * C'est le point d'entrée de l'écran qui suit la création de compte.
 *
 * Le programme régénéré ici est identique à celui montré en A6 : même profil,
 * générateur déterministe. Voir profilOnboarding.ts.
 *
 * @throws si le profil est incomplet ou absent — l'appelant doit alors renvoyer
 *   l'utilisateur au quiz plutôt que de le laisser sans programme.
 */
export async function enregistrerProgrammeEnAttente(): Promise<string> {
  const profil = await lireProfil();
  if (!estComplet(profil)) {
    throw new Error('Profil d’onboarding incomplet : impossible de régénérer le programme.');
  }

  const programId = await enregistrerProgramme(genererProgramme(profil));
  await effacerProfil();
  return programId;
}
