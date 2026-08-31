import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase } from './supabase';

/**
 * Sign in with Apple, partagé par la création de compte et la connexion.
 *
 * Une seule fonction pour les deux écrans, parce qu'Apple et Supabase n'en font
 * qu'un seul flux : `signInWithIdToken` crée le compte si l'identifiant Apple
 * est inconnu, ouvre la session existante sinon. Écrire deux chemins séparés
 * reviendrait à distinguer côté app une différence que le serveur ne fait pas.
 *
 * Ce qui distingue les deux écrans n'est donc pas l'authentification mais ce
 * qui la suit : `creer-compte.tsx` enchaîne sur l'insertion du programme,
 * `connexion.tsx` non — il existe déjà. Cette fonction n'a donc pas à dire si
 * le compte vient d'être créé : l'écran appelant le sait par construction.
 *
 * ⚠️ Rien de tout ça ne fonctionne tant que le provider Apple n'est pas
 * configuré : capability « Sign in with Apple » sur l'App ID et clé dédiée côté
 * Apple Developer Portal, Team ID / Key ID / clé privée côté Supabase. Un échec
 * à ce stade vient de là, pas du code.
 */

/** Le code d'erreur qu'`expo-apple-authentication` lève quand l'utilisateur ferme la feuille. */
const ANNULATION = 'ERR_REQUEST_CANCELED';

export type ResultatApple =
  | { statut: 'annule' }
  | { statut: 'connecte'; idUtilisateur: string };

/**
 * `false` sur un appareil qui ne sait pas faire — simulateur sans compte Apple,
 * iOS trop ancien. L'écran s'en sert pour ne pas afficher un bouton mort.
 */
export async function appleDisponible(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

export async function connexionAvecApple(): Promise<ResultatApple> {
  let identityToken: string | null;
  try {
    const identifiants = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    identityToken = identifiants.identityToken;
  } catch (e) {
    // Annuler n'est pas une erreur : l'écran ne doit rien afficher.
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === ANNULATION) {
      return { statut: 'annule' };
    }
    throw e;
  }

  if (!identityToken) {
    throw new Error("Apple n'a pas renvoyé de jeton d'identité.");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Aucune session ouverte après la connexion Apple.');

  return { statut: 'connecte', idUtilisateur: data.user.id };
}
