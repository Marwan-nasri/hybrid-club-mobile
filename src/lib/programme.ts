import { EXERCISES, NOM_EXERCICE, SUBSTITUTIONS } from './catalogue';
import { generateProgram } from './programGenerator';
import { effacerProfil, estComplet, lireProfil } from './profilOnboarding';
import { supabase } from './supabase';
import { TEMPLATES } from './templates';

import type { GeneratedProgram, GeneratedSession, GeneratorProfile } from './programGenerator';

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
 * Ce que les limitations déclarées changent concrètement, en paires
 * « exercice d'origine → substitut ». Alimente l'aperçu de l'écran A4.
 *
 * On ne rejoue pas la logique de substitution — elle est interne au moteur et
 * la dupliquer la ferait diverger au premier changement. On génère deux fois,
 * avec et sans limitations, et on compare bloc à bloc : le moteur étant
 * déterministe, tout écart vient forcément des limitations.
 *
 * ponytail: deux générations complètes (12 semaines) pour n'exploiter que la
 * semaine 1. Si ça se voit à la frappe, donner une borne de semaines à
 * generateProgram plutôt que d'optimiser ici.
 */
export function apercuSubstitutions(
  profile: GeneratorProfile,
): { avant: string; apres: string }[] {
  if (profile.limitations.length === 0) return [];

  const cle = (s: GeneratedSession, ordre: number) => `${s.jour}-${ordre}`;
  const semaine1 = (p: GeneratedProgram) => p.sessions.filter((s) => s.semaine === 1);

  const origine = new Map<string, string>();
  for (const s of semaine1(genererProgramme({ ...profile, limitations: [] }))) {
    for (const b of s.blocks) if (b.exercise_slug) origine.set(cle(s, b.ordre), b.exercise_slug);
  }

  // Map plutôt que tableau : le même remplacement revient sur plusieurs séances.
  const paires = new Map<string, string>();
  for (const s of semaine1(genererProgramme(profile))) {
    for (const b of s.blocks) {
      const avant = origine.get(cle(s, b.ordre));
      if (avant && b.exercise_slug && avant !== b.exercise_slug) paires.set(avant, b.exercise_slug);
    }
  }

  return [...paires].map(([avant, apres]) => ({
    avant: NOM_EXERCICE.get(avant) ?? avant,
    apres: NOM_EXERCICE.get(apres) ?? apres,
  }));
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
 * Le profil d'onboarding est absent ou partiel : rien à insérer, et réessayer
 * n'y changera rien. L'appelant doit renvoyer l'utilisateur au quiz.
 */
export class ProfilIncompletError extends Error {
  constructor() {
    super('Profil d’onboarding incomplet : impossible de régénérer le programme.');
    this.name = 'ProfilIncompletError';
  }
}

/**
 * Reprend le profil laissé par l'onboarding, régénère le programme et l'insère.
 * C'est le point d'entrée de l'écran qui suit la création de compte.
 *
 * Le programme régénéré ici est identique à celui montré en A6 : même profil,
 * générateur déterministe. Voir profilOnboarding.ts.
 *
 * @throws {ProfilIncompletError} si le profil est absent ou partiel.
 * @throws l'erreur Supabase si l'insertion échoue — le profil n'est PAS effacé,
 *   un simple nouvel appel suffit à réessayer.
 */
export async function enregistrerProgrammeEnAttente(): Promise<string> {
  const profil = await lireProfil();
  if (!estComplet(profil)) throw new ProfilIncompletError();

  const programId = await enregistrerProgramme(genererProgramme(profil));
  await effacerProfil();
  return programId;
}
