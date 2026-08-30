import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { chargerHistoriqueExercice, libelleDate, libellePerf } from '@/lib/progression';

import type { HistoriqueExercice, SeanceExercice } from '@/lib/progression';

const TABULAR = { fontVariant: ['tabular-nums' as const] };

/**
 * B9 allégé : l'historique brut des séries loggées sur un exercice.
 *
 * Ni badge « Record », ni 1RM estimé, ni courbe de tendance — décider ce qui
 * constitue un record (formule, fenêtre de comparaison, égalités) est un
 * chantier à part. On montre ce qui a été fait, sans le juger.
 */
function LigneSeance({ seance, dernier }: { seance: SeanceExercice; dernier: boolean }) {
  const series = seance.series
    .map((s) => libellePerf(s.charge_kg, s.reps))
    .join(' · ');

  return (
    <View className={`px-4 py-4 ${dernier ? '' : 'border-b border-border'}`}>
      <Text className="text-base text-text-primary">{libelleDate(seance.date)}</Text>
      <Text className="mt-1 text-sm text-text-secondary" style={TABULAR}>
        {series}
        {seance.rpe === null ? '' : ` — RPE ${String(seance.rpe).replace('.', ',')}`}
      </Text>
    </View>
  );
}

export default function DetailExerciceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // `undefined` = en cours de chargement, `null` = aucun historique.
  const [etat, setEtat] = useState<HistoriqueExercice | null | undefined>(undefined);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(async () => {
    setErreur(false);
    try {
      setEtat(await chargerHistoriqueExercice(id));
    } catch {
      setErreur(true);
    }
  }, [id]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        <View className="px-5 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => router.back()}
            className="h-14 w-14 justify-center">
            <Text className="text-2xl text-text-primary">‹</Text>
          </Pressable>
        </View>

        {erreur ? (
          <View className="flex-1 justify-center px-5">
            <Text className="text-3xl font-bold text-text-primary">Exercice indisponible</Text>
            <Text className="mt-3 text-base text-text-secondary">
              Impossible de récupérer cet historique. Vérifie ta connexion.
            </Text>
            <View className="mt-6">
              <Button label="Réessayer" variant="secondary" onPress={charger} />
            </View>
          </View>
        ) : etat === undefined ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : etat === null ? (
          <View className="flex-1 justify-center px-5">
            <Text className="text-3xl font-bold text-text-primary">Aucun historique</Text>
            <Text className="mt-3 text-base text-text-secondary">
              Aucune série n’a encore été enregistrée sur cet exercice.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerClassName="px-5 pb-8">
            <Text className="text-3xl font-bold text-text-primary">{etat.nom}</Text>
            <Text className="mt-1 text-base text-text-secondary">
              {etat.seances.length}{' '}
              {etat.seances.length === 1 ? 'séance enregistrée' : 'séances enregistrées'}
            </Text>

            <Text className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-text-tertiary">
              Historique
            </Text>

            <Card className="p-0">
              {etat.seances.map((s, i) => (
                <LigneSeance
                  key={s.workout_log_id}
                  seance={s}
                  dernier={i === etat.seances.length - 1}
                />
              ))}
            </Card>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
