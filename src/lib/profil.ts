import { supabase } from './supabase';

import type { GoalType } from './programGenerator';

/**
 * Le profil tel que l'écran Profil (B10) le lit et l'écrit.
 *
 * Tout est optionnel sauf les deux préférences : le quiz laisse passer des
 * questions (prénom, poids, date de naissance ne sont pas requis par
 * `estComplet`), et un champ absent doit disparaître de l'écran plutôt que
 * d'être remplacé par une valeur inventée.
 */
export type ProfilUtilisateur = {
  prenom: string | null;
  email: string | null;
  age: number | null;
  poids_kg: number | null;
  objectif: GoalType | null;
  unite_poids: UnitePoids;
  notifications_actives: boolean;
};

export type UnitePoids = 'kg' | 'lb';

type LigneProfil = {
  prenom: string | null;
  objectif: GoalType | null;
  poids_kg: number | null;
  date_naissance: string | null;
  unite_poids: string | null;
  notifications_actives: boolean | null;
};

/**
 * L'âge révolu. `date_naissance` est une colonne `date` : on la découpe plutôt
 * que de la passer à `new Date`, qui la lirait en UTC et pourrait retirer un
 * an la veille d'un anniversaire à l'ouest de Greenwich.
 */
function age(dateNaissance: string, aujourdhui: Date): number {
  const [a, m, j] = dateNaissance.split('-').map(Number);
  let ans = aujourdhui.getFullYear() - a;
  const moisEcoule = aujourdhui.getMonth() + 1 - m;
  if (moisEcoule < 0 || (moisEcoule === 0 && aujourdhui.getDate() < j)) ans--;
  return ans;
}

/**
 * Le poids dans l'unité choisie.
 *
 * `poids_kg` est stocké en kilos quoi qu'il arrive : `unite_poids` ne décrit
 * que l'affichage. Changer l'étiquette sans convertir la valeur afficherait
 * « 66 lb » pour 66 kg — l'écran mentirait de 45 %.
 */
export function formatPoids(kg: number, unite: UnitePoids): string {
  const valeur = unite === 'lb' ? Math.round(kg * 2.20462) : kg;
  return `${String(valeur).replace('.', ',')} ${unite}`;
}

/**
 * Le profil de l'utilisateur connecté.
 *
 * L'email vient de la session Auth et non de `profiles` : la table ne le
 * stocke pas, `auth.users` en est la seule source.
 *
 * La ligne `profiles` peut être vide — le trigger `handle_new_user` en insère
 * une à l'inscription, et seul `creer_programme` (migration 007) la remplit.
 * Un compte créé avant cette migration n'a donc que des colonnes nulles : les
 * défauts du schéma prennent le relais pour les deux préférences.
 */
export async function chargerProfil(aujourdhui: Date): Promise<ProfilUtilisateur> {
  const { data: utilisateur, error: erreurAuth } = await supabase.auth.getUser();
  if (erreurAuth) throw erreurAuth;
  if (!utilisateur.user) throw new Error('Aucun utilisateur connecté.');

  const { data, error } = await supabase
    .from('profiles')
    .select('prenom, objectif, poids_kg, date_naissance, unite_poids, notifications_actives')
    .eq('id', utilisateur.user.id)
    .maybeSingle<LigneProfil>();

  if (error) throw error;

  return {
    prenom: data?.prenom ?? null,
    email: utilisateur.user.email ?? null,
    age: data?.date_naissance ? age(data.date_naissance, aujourdhui) : null,
    // `numeric` arrive en nombre via PostgREST, mais la colonne est nullable.
    poids_kg: data?.poids_kg ?? null,
    objectif: data?.objectif ?? null,
    unite_poids: data?.unite_poids === 'lb' ? 'lb' : 'kg',
    notifications_actives: data?.notifications_actives ?? true,
  };
}

/**
 * Écrit une préférence.
 *
 * `update` et non `upsert` : la ligne existe forcément (trigger
 * `handle_new_user`), et un upsert écraserait les colonnes absentes du patch
 * par leurs défauts.
 *
 * ponytail: aucune file d'attente hors ligne — un toggle basculé sans réseau
 * remonte l'erreur et l'écran remet l'interrupteur dans son état d'origine.
 */
export async function majPreferences(
  patch: Partial<Pick<ProfilUtilisateur, 'unite_poids' | 'notifications_actives'>>,
): Promise<void> {
  const { data: utilisateur, error: erreurAuth } = await supabase.auth.getUser();
  if (erreurAuth) throw erreurAuth;
  if (!utilisateur.user) throw new Error('Aucun utilisateur connecté.');

  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', utilisateur.user.id);

  if (error) throw error;
}
