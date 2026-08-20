import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SetRow } from '@/components/ui/SetRow';

type SetState = { weight: string; reps: string; validated: boolean };

// Données mockées — le branchement sur workout_logs / set_logs viendra
// après le moteur de génération.
const SEANCE = { nom: 'Force — Haut du corps' };

type Exercice = {
  nom: string;
  reps: number;
  repos: string;
  derniereFois: string;
  series: SetState[];
};

const EXERCICES: Exercice[] = [
  {
    nom: 'Développé couché',
    reps: 6,
    repos: '2:30',
    derniereFois: '4×6 @ 92,5 kg',
    series: [
      { weight: '95', reps: '6', validated: true },
      { weight: '95', reps: '6', validated: true },
      { weight: '95', reps: '6', validated: false },
      { weight: '92,5', reps: '6', validated: false },
    ],
  },
  {
    nom: 'Tractions lestées',
    reps: 6,
    repos: '2:00',
    derniereFois: '4×6 @ +12,5 kg',
    series: Array.from({ length: 4 }, () => ({ weight: '12,5', reps: '6', validated: false })),
  },
  {
    nom: 'Développé militaire',
    reps: 8,
    repos: '1:45',
    derniereFois: '3×8 @ 47,5 kg',
    series: Array.from({ length: 3 }, () => ({ weight: '47,5', reps: '8', validated: false })),
  },
  {
    nom: 'Rowing barre',
    reps: 8,
    repos: '1:45',
    derniereFois: '4×8 @ 70 kg',
    series: Array.from({ length: 4 }, () => ({ weight: '70', reps: '8', validated: false })),
  },
  {
    nom: 'Élévations latérales',
    reps: 12,
    repos: '1:00',
    derniereFois: '3×12 @ 10 kg',
    series: Array.from({ length: 3 }, () => ({ weight: '10', reps: '12', validated: false })),
  },
];

function formatChrono(secondes: number) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  // L'écran reste allumé pendant toute la séance.
  useKeepAwake();

  // Les séries de tous les exercices, pour ne rien perdre en naviguant.
  const [seriesParExercice, setSeriesParExercice] = useState(EXERCICES.map((e) => e.series));
  const [indexExercice, setIndexExercice] = useState(0);
  const [chrono, setChrono] = useState(28 * 60 + 54);

  useEffect(() => {
    const id = setInterval(() => setChrono((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const exercice = EXERCICES[indexExercice];
  const series = seriesParExercice[indexExercice];
  const suivant = EXERCICES[indexExercice + 1];

  const majSerie = (index: number, patch: Partial<SetState>) =>
    setSeriesParExercice((tout) =>
      tout.map((ex, i) =>
        i === indexExercice ? ex.map((s, j) => (j === index ? { ...s, ...patch } : s)) : ex
      )
    );

  const validees = series.filter((s) => s.validated).length;
  // Progression sur la séance entière : exercices terminés + avancement dans l'exercice courant.
  const progression =
    ((indexExercice + validees / series.length) / EXERCICES.length) * 100;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']}>
        <View className="flex-row items-center px-5 py-2">
          <Button label="‹" variant="ghost" onPress={() => router.back()} />
          <Text className="flex-1 text-center text-sm font-medium uppercase tracking-wide text-text-secondary">
            {SEANCE.nom}
          </Text>
          <Text
            className="w-20 text-right text-2xl font-bold text-text-primary"
            style={{ fontVariant: ['tabular-nums'] }}>
            {formatChrono(chrono)}
          </Text>
        </View>

        <View className="mx-5 h-1 overflow-hidden rounded-pill bg-border">
          <View className="h-1 rounded-pill bg-accent" style={{ width: `${progression}%` }} />
        </View>

        <View className="mt-3 flex-row justify-between px-5">
          <Text className="text-base text-text-secondary">
            Exercice {indexExercice + 1} / {EXERCICES.length}
          </Text>
          <Text className="text-base text-text-secondary">
            {validees} / {series.length} séries validées
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView className="px-5" contentContainerClassName="pb-6">
        <Text className="mt-6 text-3xl font-bold text-text-primary">{exercice.nom}</Text>
        <Text className="mt-2 text-xl text-text-secondary">
          {series.length} séries · {exercice.reps} reps · repos {exercice.repos}
        </Text>

        <Card className="mt-4 self-start rounded-pill bg-surface-elevated px-4 py-2">
          <Text className="text-base text-text-secondary">
            Dernière fois : {exercice.derniereFois}
          </Text>
        </Card>

        <View className="mb-2 mt-8 flex-row px-3">
          <Text className="w-8 text-xs uppercase tracking-wide text-text-tertiary">Sér.</Text>
          <Text className="flex-1 text-xs uppercase tracking-wide text-text-tertiary">Charge</Text>
          <Text className="flex-1 text-xs uppercase tracking-wide text-text-tertiary">Reps</Text>
          <View className="w-[72px]" />
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

        <View className="mt-3">
          <Button
            label="+ Ajouter une série"
            variant="secondary"
            onPress={() =>
              setSeriesParExercice((tout) =>
                tout.map((ex, i) =>
                  i === indexExercice
                    ? [
                        ...ex,
                        {
                          weight: ex[ex.length - 1].weight,
                          reps: String(exercice.reps),
                          validated: false,
                        },
                      ]
                    : ex
                )
              )
            }
          />
        </View>
      </ScrollView>

      <View className="border-t border-border px-5 pt-3">
        <SafeAreaView edges={['bottom']}>
          <View className="flex-row gap-3">
            <Button
              label="‹"
              variant="secondary"
              disabled={indexExercice === 0}
              onPress={() => setIndexExercice((i) => i - 1)}
            />
            <Card
              className="flex-1 justify-center py-3"
              onPress={suivant ? () => setIndexExercice((i) => i + 1) : undefined}>
              <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                {suivant ? 'Suivant' : 'Dernier exercice'}
              </Text>
              <Text className="mt-1 text-xl font-semibold text-text-primary">
                {suivant ? suivant.nom : 'Terminer la séance'}
              </Text>
            </Card>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}
