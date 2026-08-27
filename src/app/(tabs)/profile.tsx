import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DesignColors } from '@/constants/theme';
import { chargerProfil, formatPoids, majPreferences } from '@/lib/profil';
import { LIBELLE_OBJECTIF } from '@/lib/programGenerator';
import { delierCompte, statutAbonnement } from '@/lib/purchases';
import { chargerBloc } from '@/lib/seances';
import { supabase } from '@/lib/supabase';

import type { ProfilUtilisateur, UnitePoids } from '@/lib/profil';
import type { StatutAbonnement } from '@/lib/purchases';
import type { EtatBloc } from '@/lib/seances';

/**
 * L'écran système de gestion des abonnements. URL Apple standard : elle ouvre
 * la feuille native, pas Safari. Rien de RevenueCat là-dedans — annuler ou
 * changer de formule se fait chez Apple, l'app ne peut que pointer dessus.
 */
const URL_ABONNEMENTS = 'https://apps.apple.com/account/subscriptions';

const LIBELLE_UNITE: Record<UnitePoids, string> = { kg: 'kg', lb: 'lb' };

const MOIS_COURT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** « 25 août » — formaté à la main, comme partout ailleurs dans l'app. */
function libelleDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MOIS_COURT[d.getMonth()]}`;
}

function Entete({ profil }: { profil: ProfilUtilisateur }) {
  // Chaque miette est optionnelle : le quiz n'impose ni prénom, ni poids, ni
  // date de naissance. Un champ manquant sort de la ligne au lieu d'afficher
  // un tiret ou une valeur par défaut.
  const details = [
    profil.email,
    profil.age !== null ? `${profil.age} ans` : null,
    profil.poids_kg !== null ? formatPoids(profil.poids_kg, profil.unite_poids) : null,
  ].filter(Boolean);

  return (
    <>
      <Text className="text-3xl font-bold text-text-primary">
        {profil.prenom ?? 'Mon compte'}
      </Text>
      {details.length > 0 ? (
        <Text className="mt-1 text-base text-text-secondary">{details.join(' · ')}</Text>
      ) : null}
    </>
  );
}

/**
 * Le bloc en cours. Pas de date d'événement ni de « Changer d'objectif » de la
 * maquette : aucune colonne ne porte de date cible, et régénérer un programme
 * relève du chantier fin de cycle.
 */
function CarteProgramme({ etat }: { etat: EtatBloc }) {
  if (etat.statut !== 'ok') {
    return (
      <Card className="mt-6">
        <Text className="text-sm font-medium uppercase tracking-wide text-text-tertiary">
          Programme en cours
        </Text>
        <Text className="mt-2 text-base text-text-secondary">Aucun programme actif</Text>
      </Card>
    );
  }

  const { bloc } = etat;
  const detail = [
    bloc.hors_bloc
      ? `Bloc de ${bloc.duree_semaines} semaines terminé`
      : `Semaine ${bloc.semaine_courante} / ${bloc.duree_semaines}`,
    bloc.objectif ? `objectif ${LIBELLE_OBJECTIF[bloc.objectif]}` : null,
  ].filter(Boolean);

  return (
    <Card className="mt-6">
      <Text className="text-sm font-medium uppercase tracking-wide text-text-tertiary">
        Programme en cours
      </Text>
      <Text className="mt-2 text-xl font-semibold text-text-primary">{bloc.nom}</Text>
      <Text className="mt-1 text-base text-text-secondary">{detail.join(' · ')}</Text>
    </Card>
  );
}

function libelleAbonnement(statut: StatutAbonnement): { titre: string; detail: string | null } {
  switch (statut.etat) {
    case 'essai':
      return {
        titre: 'Essai en cours',
        detail: statut.expire_le
          ? `Jusqu'au ${libelleDate(statut.expire_le)}${statut.renouvelle ? ' · reconduit ensuite' : ' · sans reconduction'}`
          : null,
      };
    case 'actif':
      return {
        titre: 'Abonnement actif',
        detail: statut.expire_le
          ? `${statut.renouvelle ? 'Renouvellement le' : 'Se termine le'} ${libelleDate(statut.expire_le)}`
          : null,
      };
    case 'expire':
      return {
        titre: 'Abonnement expiré',
        detail: statut.expire_le ? `Depuis le ${libelleDate(statut.expire_le)}` : null,
      };
    case 'aucun':
      return { titre: 'Aucun abonnement', detail: null };
  }
}

/**
 * Le statut vient de RevenueCat, donc du réseau : `null` = pas encore chargé,
 * `'indisponible'` = l'appel a échoué. Un abonné hors ligne ne doit pas lire
 * « aucun abonnement ».
 */
function CarteAbonnement({ statut }: { statut: StatutAbonnement | 'indisponible' | null }) {
  const contenu =
    statut === null ? { titre: 'Abonnement', detail: 'Chargement…' }
    : statut === 'indisponible' ? { titre: 'Abonnement', detail: 'Statut indisponible hors ligne' }
    : libelleAbonnement(statut);

  return (
    <Card className="mt-4 !border-accent">
      <Text className="text-xl font-semibold text-text-primary">{contenu.titre}</Text>
      {contenu.detail ? (
        <Text className="mt-1 text-base text-text-secondary">{contenu.detail}</Text>
      ) : null}

      <Pressable
        accessibilityRole="link"
        onPress={() => Linking.openURL(URL_ABONNEMENTS)}
        className="mt-3 min-h-14 justify-center active:opacity-80">
        <Text className="text-base font-semibold text-accent">Gérer mon abonnement</Text>
      </Pressable>
    </Card>
  );
}

function Ligne({
  label,
  children,
  onPress,
  dernier,
}: {
  label: string;
  children: ReactNode;
  onPress?: () => void;
  dernier?: boolean;
}) {
  const contenu = (
    <View
      className={`min-h-14 flex-row items-center justify-between px-4 py-3 ${
        dernier ? '' : 'border-b border-border'
      }`}>
      <Text className="text-base text-text-primary">{label}</Text>
      {children}
    </View>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} className="active:opacity-80">
      {contenu}
    </Pressable>
  ) : (
    contenu
  );
}

export default function ProfilScreen() {
  const [date] = useState(() => new Date());
  const [profil, setProfil] = useState<ProfilUtilisateur | null>(null);
  const [bloc, setBloc] = useState<EtatBloc | null>(null);
  const [abonnement, setAbonnement] = useState<StatutAbonnement | 'indisponible' | null>(null);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(async () => {
    setErreur(false);
    try {
      const [p, b] = await Promise.all([chargerProfil(date), chargerBloc(date)]);
      setProfil(p);
      setBloc(b);
    } catch {
      setErreur(true);
    }
    // À part : un RevenueCat injoignable ne doit pas emporter tout l'écran.
    try {
      setAbonnement(await statutAbonnement());
    } catch {
      setAbonnement('indisponible');
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  /**
   * Bascule optimiste : l'interrupteur suit le doigt tout de suite, et revient
   * à sa place si l'écriture échoue. Attendre le réseau donnerait un toggle
   * qui colle.
   */
  const basculer = useCallback(
    async (patch: Partial<Pick<ProfilUtilisateur, 'unite_poids' | 'notifications_actives'>>) => {
      if (!profil) return;
      const avant = profil;
      setProfil({ ...profil, ...patch });
      try {
        await majPreferences(patch);
      } catch {
        setProfil(avant);
      }
    },
    [profil],
  );

  const deconnecter = useCallback(async () => {
    // RevenueCat avant Supabase : détacher l'identité demande le réseau, et il
    // vaut mieux le tenter tant que la session est encore valide.
    //
    // L'échec ne bloque pas la déconnexion — rester coincé dans l'app serait
    // pire que la fenêtre de fuite, que `lierCompte` referme de toute façon à
    // la prochaine création de compte.
    try {
      await delierCompte();
    } catch {
      // best-effort
    }
    await supabase.auth.signOut();
    router.replace('/accroche');
  }, []);

  if (erreur) {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1">
          <View className="flex-1 justify-center px-5">
            <Text className="text-3xl font-bold text-text-primary">Profil indisponible</Text>
            <Text className="mt-3 text-base text-text-secondary">
              Impossible de récupérer ton compte. Vérifie ta connexion.
            </Text>
            <View className="mt-6">
              <Button label="Réessayer" variant="secondary" onPress={charger} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!profil || !bloc) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
          <Entete profil={profil} />
          <CarteProgramme etat={bloc} />
          <CarteAbonnement statut={abonnement} />

          <Text className="mt-8 text-sm font-medium uppercase tracking-wide text-text-tertiary">
            Préférences
          </Text>

          <Card className="mt-3 p-0">
            <Ligne
              label="Unités"
              onPress={() => basculer({ unite_poids: profil.unite_poids === 'kg' ? 'lb' : 'kg' })}>
              <Text className="text-base text-text-secondary">
                {LIBELLE_UNITE[profil.unite_poids]}
              </Text>
            </Ligne>

            <Ligne label="Rappels de séance" dernier>
              <Switch
                value={profil.notifications_actives}
                onValueChange={(v) => basculer({ notifications_actives: v })}
                trackColor={{ false: DesignColors.border, true: DesignColors.accent }}
              />
            </Ligne>
          </Card>

          <View className="mt-8">
            <Button label="Se déconnecter" variant="secondary" onPress={deconnecter} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
