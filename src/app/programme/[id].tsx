import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { chargerSeance, statutSeance } from '@/lib/seanceLive';

import type { Bloc, SeanceLive } from '@/lib/seanceLive';

type Etat = { seance: SeanceLive; statut: 'termine' | 'en_cours' | 'a_venir' };

/** « 2:30 » — le repos prescrit, comme sur la maquette B3. */
function formatRepos(secondes: number): string {
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;
}

function Pastille({ texte, sourdine = false }: { texte: string; sourdine?: boolean }) {
  return (
    <View className="rounded-pill bg-surface-elevated px-3 py-1">
      <Text
        className={`text-sm ${sourdine ? 'text-text-tertiary' : 'text-text-primary'}`}
        style={{ fontVariant: ['tabular-nums'] }}>
        {texte}
      </Text>
    </View>
  );
}

function CarteBloc({ bloc }: { bloc: Bloc }) {
  const pastilles =
    bloc.kind === 'exercice'
      ? [
          bloc.reps_cible ? `${bloc.series} × ${bloc.reps_cible}` : `${bloc.series} séries`,
          bloc.rpe ? `RPE ${bloc.rpe}` : null,
        ]
      : [bloc.detail];

  return (
    <Card className="mt-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="flex-1 pr-3 text-base font-semibold text-text-primary">{bloc.nom}</Text>
        {bloc.kind === 'exercice' && bloc.repos_sec ? (
          <Text
            className="text-sm text-text-tertiary"
            style={{ fontVariant: ['tabular-nums'] }}>
            Repos {formatRepos(bloc.repos_sec)}
          </Text>
        ) : null}
      </View>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {pastilles.filter((p): p is string => !!p).map((p) => (
          <Pastille key={p} texte={p} />
        ))}
      </View>

      {bloc.notes ? (
        <Text className="mt-3 text-sm text-text-secondary">{bloc.notes}</Text>
      ) : null}
    </Card>
  );
}

export default function DetailSeanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(async () => {
    setErreur(false);
    try {
      const [seance, statut] = await Promise.all([chargerSeance(id), statutSeance(id)]);
      setEtat({ seance, statut });
    } catch {
      setErreur(true);
    }
  }, [id]);

  useEffect(() => {
    charger();
  }, [charger]);

  const exercices = etat?.seance.blocs.filter((b) => b.kind === 'exercice') ?? [];
  const series = exercices.reduce((t, b) => t + b.series, 0);

  const sousTitre = etat
    ? [
        `${etat.seance.blocs.length} ${etat.seance.blocs.length === 1 ? 'exercice' : 'exercices'}`,
        series > 0 ? `${series} séries` : null,
        etat.seance.duree_estimee_min ? `~${etat.seance.duree_estimee_min} min` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

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
            <Text className="text-3xl font-bold text-text-primary">Séance indisponible</Text>
            <Text className="mt-3 text-base text-text-secondary">
              Impossible de récupérer cette séance. Vérifie ta connexion.
            </Text>
            <View className="mt-6">
              <Button label="Réessayer" variant="secondary" onPress={charger} />
            </View>
          </View>
        ) : etat === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <ScrollView contentContainerClassName="px-5 pb-4">
              <Text className="text-3xl font-bold text-text-primary">{etat.seance.nom}</Text>
              <Text className="mt-1 text-base text-text-secondary">{sousTitre}</Text>

              {etat.seance.note_coaching ? (
                <Text className="mt-3 text-sm text-text-secondary">
                  {etat.seance.note_coaching}
                </Text>
              ) : null}

              {etat.seance.blocs.map((b, i) => (
                <CarteBloc key={`${b.nom}-${i}`} bloc={b} />
              ))}
            </ScrollView>

            <View className="px-5 pb-4 pt-2">
              {/* Le détail des séries réellement faites viendra avec l'onglet
                  Progression : ici, seul le fait que la séance soit close. */}
              {etat.statut === 'termine' ? (
                <Card className="items-center">
                  <Text className="text-base font-semibold text-text-primary">
                    Séance terminée
                  </Text>
                </Card>
              ) : (
                <Button
                  label={etat.statut === 'en_cours' ? 'Reprendre la séance' : 'Démarrer la séance'}
                  onPress={() =>
                    router.push({ pathname: '/workout/[id]', params: { id: etat.seance.id } })
                  }
                />
              )}
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
