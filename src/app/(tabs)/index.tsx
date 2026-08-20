import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SetRow } from '@/components/ui/SetRow';
import { Sheet } from '@/components/ui/Sheet';
import { StatBlock } from '@/components/ui/StatBlock';

type SetState = { weight: string; reps: string; validated: boolean };

// Reprend la séance de la maquette B4-workout-live.
const SERIES_INITIALES: SetState[] = [
  { weight: '95', reps: '6', validated: true },
  { weight: '95', reps: '6', validated: true },
  { weight: '95', reps: '6', validated: false },
  { weight: '92,5', reps: '6', validated: false },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-8">
      <Text className="mb-3 text-sm font-medium uppercase tracking-wide text-text-tertiary">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function HomeScreen() {
  const [series, setSeries] = useState(SERIES_INITIALES);
  const [poidsCorps, setPoidsCorps] = useState('78,4');
  const [sheetVisible, setSheetVisible] = useState(false);

  const majSerie = (index: number, patch: Partial<SetState>) =>
    setSeries((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView className="px-5" contentContainerClassName="pb-24">
          <Text className="mt-4 text-3xl font-bold text-text-primary">Composants</Text>
          <Text className="mt-1 text-base text-text-secondary">
            Planche de validation des 6 briques de base.
          </Text>

          {/* --- TEMPORAIRE : accès aux écrans tant que l'onboarding n'existe pas.
              Supprimer ce bloc (et l'import `router`) quand le vrai flux sera en place. --- */}
          <Section title="Écrans">
            <View className="gap-3">
              <Button
                label="A6 — Reveal du plan"
                variant="secondary"
                onPress={() => router.push('/reveal')}
              />
              <Button
                label="B4 — Séance live"
                variant="secondary"
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: '1' } })}
              />
              <Button
                label="A7 — Paywall"
                variant="secondary"
                onPress={() => router.push('/paywall')}
              />
            </View>
          </Section>
          {/* --- fin du bloc temporaire --- */}

          <Section title="SetRow">
            <Text className="mb-2 text-xl font-semibold text-text-primary">Développé couché</Text>
            <View className="mb-2 flex-row px-3">
              <Text className="w-8 text-xs uppercase tracking-wide text-text-tertiary">Sér.</Text>
              <Text className="flex-1 text-xs uppercase tracking-wide text-text-tertiary">
                Charge
              </Text>
              <Text className="flex-1 text-xs uppercase tracking-wide text-text-tertiary">Reps</Text>
              <View className="w-16" />
            </View>
            <View className="gap-3">
              {series.map((s, i) => (
                <SetRow
                  key={i}
                  index={i + 1}
                  weight={s.weight}
                  reps={s.reps}
                  validated={s.validated}
                  onChangeWeight={(weight) => majSerie(i, { weight })}
                  onChangeReps={(reps) => majSerie(i, { reps })}
                  onValidate={() => majSerie(i, { validated: !s.validated })}
                />
              ))}
            </View>
          </Section>

          <Section title="Button">
            <View className="gap-3">
              <Button label="Commencer l'essai de 7 jours" onPress={() => setSheetVisible(true)} />
              <Button label="+ Ajouter une série" variant="secondary" onPress={() => {}} />
              <Button label="Passer cette étape" variant="ghost" onPress={() => {}} />
              <Button label="Indisponible" disabled onPress={() => {}} />
            </View>
          </Section>

          <Section title="Card">
            <View className="gap-3">
              <Card>
                <View className="flex-row items-center">
                  <Text className="w-12 text-sm font-medium uppercase tracking-wide text-accent">
                    Lun
                  </Text>
                  <View className="flex-1">
                    <Text className="text-xl font-semibold text-text-primary">
                      Force — Bas du corps
                    </Text>
                    <Text className="mt-1 text-base text-text-secondary">
                      Back squat 4×5 · RDL · Fentes lestées
                    </Text>
                  </View>
                  <Text className="text-base text-text-secondary">62 min</Text>
                </View>
              </Card>
              <Card onPress={() => {}}>
                <View className="flex-row items-center">
                  <Text className="w-12 text-sm font-medium uppercase tracking-wide text-accent">
                    Mar
                  </Text>
                  <View className="flex-1">
                    <Text className="text-xl font-semibold text-text-primary">
                      Endurance — Seuil
                    </Text>
                    <Text className="mt-1 text-base text-text-secondary">
                      6×800 m @ 4&apos;12/km · r 90 s
                    </Text>
                  </View>
                  <Text className="text-base text-text-secondary">48 min</Text>
                </View>
              </Card>
            </View>
          </Section>

          <Section title="StatBlock">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <StatBlock label="Durée" value="12 sem." />
              </View>
              <View className="flex-1">
                <StatBlock label="Fréquence" value="5 / sem." />
              </View>
              <View className="flex-1">
                <StatBlock label="Volume" value="5h20" />
              </View>
            </View>
            <View className="mt-3 flex-row gap-3">
              <View className="flex-1">
                <StatBlock label="Développé couché" value="95 kg" delta="+2,5 kg" />
              </View>
              <View className="flex-1">
                <StatBlock label="Allure seuil" value="4'12/km" delta="-3 s/km" />
              </View>
            </View>
          </Section>

          <Section title="Input">
            <Input
              label="Poids de corps"
              value={poidsCorps}
              onChangeText={setPoidsCorps}
              placeholder="78,4"
              keyboardType="decimal-pad"
            />
          </Section>

          <Section title="Sheet">
            <Button
              label="Ouvrir le bottom sheet"
              variant="secondary"
              onPress={() => setSheetVisible(true)}
            />
          </Section>
        </ScrollView>
      </SafeAreaView>

      <Sheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title="Abonnement annuel">
        <Text className="text-base text-text-secondary">
          89,99 € par an, soit 7,50 € par mois. 7 jours gratuits, puis prélèvement.
        </Text>
        <View className="mt-6 gap-3">
          <Button label="Commencer l'essai" onPress={() => setSheetVisible(false)} />
          <Button label="Plus tard" variant="ghost" onPress={() => setSheetVisible(false)} />
        </View>
      </Sheet>
    </View>
  );
}
