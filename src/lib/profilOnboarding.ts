import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeneratorProfile } from './programGenerator';

/**
 * Le profil d'onboarding, accumulé écran par écran et persisté à chaque réponse.
 *
 * C'est ce profil — pas le programme généré — qui traverse le tunnel
 * quiz → reveal → paywall → création de compte → insertion. Le générateur est
 * pur et déterministe : `programme = f(profil)`, donc régénérer après
 * l'authentification redonne exactement le programme montré en A6.
 *
 * La feuille de paiement Apple passe l'app en arrière-plan et iOS peut la
 * purger : un état en mémoire (variable de module, contexte React) serait perdu
 * au pire moment du tunnel. D'où AsyncStorage, déjà présent pour la session
 * Supabase.
 *
 * ⚠️ Cette approche tient tant que le moteur reste strictement déterministe.
 * S'il gagne de la variété (pool d'exercices tournants, aléatoire), le
 * programme affiché en A6 et celui inséré après l'auth divergeraient : il
 * faudra alors transporter le programme lui-même.
 */

const CLE = 'onboarding.profil';

/**
 * Ce que le quiz collecte : les champs dont le moteur a besoin, plus ceux qui
 * ne servent qu'à `profiles` (personnalisation, suivi). Le moteur n'en voit
 * jamais que le sous-ensemble `GeneratorProfile`.
 */
export type ProfilOnboarding = GeneratorProfile & {
  /** En secondes. Demandé seulement si l'objectif est hyrox ou marathon_muscu. */
  temps_5k_sec: number | null;
  prenom: string | null;
  poids_kg: number | null;
  taille_cm: number | null;
  /** ISO `YYYY-MM-DD`, comme la colonne `profiles.date_naissance`. */
  date_naissance: string | null;
};

export type ProfilPartiel = Partial<ProfilOnboarding>;

/**
 * Les seules clés qui bloquent la génération — `squat_1rm: null` compte comme
 * répondu. Les champs optionnels du quiz n'entrent pas ici : leur absence
 * n'empêche rien.
 */
const CHAMPS_REQUIS: (keyof GeneratorProfile)[] = [
  'objectif',
  'niveau',
  'jours_dispo',
  'equipement',
  'limitations',
  'squat_1rm',
  'bench_1rm',
  'deadlift_1rm',
];

export function estComplet(profil: ProfilPartiel): profil is GeneratorProfile {
  return CHAMPS_REQUIS.every((champ) => champ in profil);
}

/** Le profil accumulé jusqu'ici — `{}` si le quiz n'a jamais été commencé. */
export async function lireProfil(): Promise<ProfilPartiel> {
  const brut = await AsyncStorage.getItem(CLE);
  if (!brut) return {};
  try {
    return JSON.parse(brut) as ProfilPartiel;
  } catch {
    // Écriture interrompue ou format d'une version antérieure : on repart de zéro
    // plutôt que de faire planter le quiz sur un JSON illisible.
    return {};
  }
}

/** Fusionne une réponse dans le profil et le persiste. À appeler à chaque écran. */
export async function majProfil(reponse: ProfilPartiel): Promise<ProfilPartiel> {
  const profil = { ...(await lireProfil()), ...reponse };
  await AsyncStorage.setItem(CLE, JSON.stringify(profil));
  return profil;
}

/**
 * Efface le profil d'onboarding après insertion réussie du programme.
 *
 * Attention : ce que le profil contient est alors **perdu**. `profiles` n'est
 * écrit par personne — ni par `creer_programme` (migration 006), ni par
 * `creer-compte.tsx`. Les 1RM, l'anthropométrie et le prénom ne survivent donc
 * pas à l'onboarding, alors que le schéma prévoit des colonnes pour eux.
 *
 * À corriger avec l'écriture du réalisé : écrire `profiles` ici, avant le
 * removeItem. Voir « Chantiers ouverts » dans CLAUDE.md.
 */
export async function effacerProfil(): Promise<void> {
  await AsyncStorage.removeItem(CLE);
}
