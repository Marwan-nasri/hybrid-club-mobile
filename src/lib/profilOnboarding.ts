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

export type ProfilPartiel = Partial<GeneratorProfile>;

/** Toutes les clés que le moteur exige — `squat_1rm: null` compte comme répondu. */
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

/** Après insertion réussie : le profil vit désormais dans `profiles`. */
export async function effacerProfil(): Promise<void> {
  await AsyncStorage.removeItem(CLE);
}
