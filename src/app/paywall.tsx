import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

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
  const annuel = offre === 'annuel';

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
                  89,99 €
                </Text>
                <Text className="ml-2 text-base text-text-secondary">
                  / an — soit 7,50 €/mois
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
                  14,99 € / mois
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
          <Button
            label={annuel ? "Commencer l'essai de 7 jours" : "S'abonner — 14,99 €/mois"}
            onPress={() => {}}
          />
          <Text className="mt-3 text-center text-xs text-text-tertiary">
            {annuel ? "Aucun prélèvement aujourd'hui" : 'Prélèvement immédiat'}
          </Text>
          <View className="mt-1 flex-row justify-center">
            <LienDiscret label="Restaurer les achats" onPress={() => {}} />
            <LienDiscret label="CGU" onPress={() => {}} />
            <LienDiscret label="Confidentialité" onPress={() => {}} />
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}
