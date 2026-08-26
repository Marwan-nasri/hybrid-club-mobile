import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { acheter, chargerOffres, restaurer, type Offres } from '@/lib/purchases';

type Offre = 'annuel' | 'mensuel';

const PLAN = {
  nom: 'Bloc Hyrox — Base 1',
  duree_semaines: 12,
  frequence_hebdo: 5,
};

const ARGUMENTS = [
  'Chaque semaine est réécrite selon ce que tu as réellement soulevé et couru.',
  "Force et endurance planifiées ensemble — l'une ne mange plus l'autre.",
  'Ton épaule droite est prise en compte sans réduire le volume total.',
];

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function finEssai() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

function LienDiscret({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="px-2 py-3 active:opacity-60">
      <Text className="text-xs text-text-tertiary">{label}</Text>
    </Pressable>
  );
}

export default function PaywallScreen() {
  const [offre, setOffre] = useState<Offre>('annuel');
  const [offres, setOffres] = useState<Offres>({ annuel: null, mensuel: null });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const annuel = offre === 'annuel';
  const paquet = annuel ? offres.annuel : offres.mensuel;

  // Offering absent tant que le compte Apple n'est pas validé. On n'affiche
  // rien : les prix de la maquette servent de repli, ils seront remplacés par
  // ceux de l'App Store dès que les produits existeront.
  useEffect(() => {
    chargerOffres().then(setOffres).catch(() => {});
  }, []);

  const valider = async () => {
    if (!paquet) {
      // TODO: supprimer avec l'arrivée des vrais produits. En attendant, cette
      // sortie garde le tunnel quiz → reveal → paywall → compte testable en
      // dev. `__DEV__` est faux en build de release : rien ne fuit en prod.
      if (__DEV__) {
        router.replace('/creer-compte');
        return;
      }
      setErreur("Les offres ne sont pas disponibles pour le moment. Réessaie dans un instant.");
      return;
    }

    setEnCours(true);
    setErreur(null);
    try {
      if (await acheter(paquet)) router.replace('/creer-compte');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'achat n'a pas abouti.");
    } finally {
      setEnCours(false);
    }
  };

  const restaurerAchats = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      if (await restaurer()) router.replace('/creer-compte');
      else setErreur('Aucun abonnement actif sur ce compte Apple.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'La restauration a échoué.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row justify-end px-5">
          <Button label="✕" variant="ghost" onPress={() => router.back()} />
        </View>

        <ScrollView className="px-5" contentContainerClassName="pb-44">
          <Text className="text-3xl font-bold text-text-primary">
            Ton bloc de {PLAN.duree_semaines} semaines est construit.
          </Text>
          <Text className="mt-3 text-xl text-text-secondary">
            {PLAN.nom} · {PLAN.frequence_hebdo} séances par semaine, recalculées à partir de tes
            charges réelles.
          </Text>

          <View className="mt-8 gap-5">
            {ARGUMENTS.map((a) => (
              <View key={a} className="flex-row">
                <View className="mr-4 mt-1 h-6 w-6 rounded-pill border border-accent" />
                <Text className="flex-1 text-base text-text-primary">{a}</Text>
              </View>
            ))}
          </View>

          <View className="mt-8 gap-3">
            <Card
              onPress={() => setOffre('annuel')}
              className={annuel ? '!border-accent' : ''}>
              <View className="flex-row items-center">
                <View
                  className={`mr-3 h-6 w-6 rounded-pill ${
                    annuel ? 'bg-accent' : 'border border-border'
                  }`}
                />
                <Text
                  className={`flex-1 text-2xl font-bold ${
                    annuel ? 'text-text-primary' : 'text-text-secondary'
                  }`}>
                  Annuel
                </Text>
                <View className="rounded-pill bg-accent px-3 py-1">
                  <Text className="text-sm font-bold text-background">-50%</Text>
                </View>
              </View>
              <View className="mt-4 flex-row items-baseline">
                <Text
                  className="text-3xl font-bold text-text-primary"
                  style={{ fontVariant: ['tabular-nums'] }}>
                  {offres.annuel?.product.priceString ?? '89,99 €'}
                </Text>
                <Text className="ml-2 text-base text-text-secondary">
                  / an — soit {offres.annuel?.product.pricePerMonthString ?? '7,50 €'}/mois
                </Text>
              </View>
              <Text className="mt-2 text-sm font-semibold text-accent">
                7 jours gratuits, puis prélèvement
              </Text>
            </Card>

            <Card
              onPress={() => setOffre('mensuel')}
              className={!annuel ? '!border-accent' : ''}>
              <View className="flex-row items-center">
                <View
                  className={`mr-3 h-6 w-6 rounded-pill ${
                    !annuel ? 'bg-accent' : 'border border-border'
                  }`}
                />
                <Text
                  className={`flex-1 text-2xl font-bold ${
                    !annuel ? 'text-text-primary' : 'text-text-secondary'
                  }`}>
                  Mensuel
                </Text>
                <Text
                  className="text-xl text-text-secondary"
                  style={{ fontVariant: ['tabular-nums'] }}>
                  {offres.mensuel?.product.priceString ?? '14,99 €'} / mois
                </Text>
              </View>
            </Card>
          </View>

          <Text className="mt-6 text-xs text-text-tertiary">
            {annuel
              ? `Essai gratuit jusqu'au ${finEssai()}. Sans annulation 24 h avant, l'abonnement annuel à 89,99 € se renouvelle automatiquement. Résiliable à tout moment depuis les réglages de ton compte Apple.`
              : "L'abonnement mensuel à 14,99 € se renouvelle automatiquement chaque mois. Pas d'essai gratuit sur cette formule. Résiliable à tout moment depuis les réglages de ton compte Apple."}
          </Text>
        </ScrollView>
      </SafeAreaView>

      <View className="absolute inset-x-0 bottom-0 bg-background px-5 pt-3">
        <SafeAreaView edges={['bottom']}>
          {/* Le design system n'a pas de couleur d'erreur : `text-warning` est
              réservé aux contre-indications. Même surface encadrée qu'en A8. */}
          {erreur ? (
            <View className="mb-3 rounded-card border border-border bg-surface p-4">
              <Text className="text-base text-text-primary">{erreur}</Text>
            </View>
          ) : null}
          <Button
            label={
              enCours
                ? 'Un instant…'
                : annuel
                  ? "Commencer l'essai de 7 jours"
                  : `S'abonner — ${offres.mensuel?.product.priceString ?? '14,99 €'}/mois`
            }
            disabled={enCours}
            onPress={valider}
          />
          <Text className="mt-3 text-center text-xs text-text-tertiary">
            {annuel ? "Aucun prélèvement aujourd'hui" : 'Prélèvement immédiat'}
          </Text>
          <View className="mt-1 flex-row justify-center">
            <LienDiscret label="Restaurer les achats" onPress={restaurerAchats} />
            <LienDiscret label="CGU" onPress={() => {}} />
            <LienDiscret label="Confidentialité" onPress={() => {}} />
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}
