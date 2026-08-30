import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatBlock } from '@/components/ui/StatBlock';
import {
  chargerProgression,
  libelleDate,
  libellePerf,
  libelleVolume,
  LIBELLE_PERIODE,
  pourcent,
} from '@/lib/progression';

import type { ExerciceTravaille, Periode, Progression, SemaineVolume } from '@/lib/progression';

const TABULAR = { fontVariant: ['tabular-nums' as const] };

const PERIODES: Periode[] = ['6sem', '3mois', '1an'];

function Titre({ texte }: { texte: string }) {
  return (
    <Text className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-text-tertiary">
      {texte}
    </Text>
  );
}

function Selecteur({
  periode,
  onChange,
}: {
  periode: Periode;
  onChange: (p: Periode) => void;
}) {
  return (
    <View className="mt-6 flex-row gap-2">
      {PERIODES.map((p) => (
        <Pressable
          key={p}
          accessibilityRole="button"
          accessibilityState={{ selected: p === periode }}
          onPress={() => onChange(p)}
          className={`h-14 flex-1 items-center justify-center rounded-pill border active:opacity-80 ${
            p === periode ? 'border-accent' : 'border-border'
          }`}>
          <Text
            className={`text-base font-semibold ${
              p === periode ? 'text-accent' : 'text-text-secondary'
            }`}>
            {LIBELLE_PERIODE[p]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Une barre par semaine de la période. Les semaines sans série gardent leur
 * colonne, réduite à un trait : le creux fait partie de l'information.
 *
 * La dernière barre — la semaine en cours — est la seule en accent plein.
 *
 * ponytail: sur « 1 an », 52 colonnes tiennent dans ~335 pt, soit une barre de
 * 4 px. Lisible tant qu'un compte n'a que quelques semaines d'historique, ce
 * qui sera le cas encore longtemps. Agréger par mois au-delà de 13 semaines le
 * jour où quelqu'un aura de quoi remplir l'année.
 */
function VolumeParSemaine({ semaines }: { semaines: SemaineVolume[] }) {
  const max = Math.max(...semaines.map((s) => s.volume_kg));

  if (max === 0) {
    return (
      <Card>
        <Text className="text-base text-text-secondary">
          Aucune série enregistrée sur cette période.
        </Text>
      </Card>
    );
  }

  // 52 colonnes n'ont pas la place de porter un libellé : au-delà de la vue
  // 6 semaines, seules les bornes sont annotées.
  const libelles = semaines.length <= 6;
  const bornesMemeAnnee =
    semaines[0].lundi.getFullYear() === semaines[semaines.length - 1].lundi.getFullYear();

  return (
    <Card>
      <View className="h-32 flex-row items-end" style={{ gap: semaines.length <= 13 ? 4 : 1 }}>
        {semaines.map((s, i) => (
          <View key={s.lundi.getTime()} className="h-full flex-1 justify-end">
            <View
              className={
                s.volume_kg === 0 ? 'bg-border'
                : i === semaines.length - 1 ? 'bg-accent'
                : 'bg-accent/30'
              }
              style={{
                height: s.volume_kg === 0 ? 2 : `${Math.max(4, (s.volume_kg / max) * 100)}%`,
              }}
            />
          </View>
        ))}
      </View>

      {libelles ? (
        <View className="mt-2 flex-row" style={{ gap: 4 }}>
          {semaines.map((s) => (
            <Text
              key={s.lundi.getTime()}
              className="flex-1 text-center text-xs text-text-tertiary"
              style={TABULAR}>
              {s.label}
            </Text>
          ))}
        </View>
      ) : (
        <View className="mt-2 flex-row justify-between">
          {[semaines[0], semaines[semaines.length - 1]].map((s) => (
            <Text key={s.lundi.getTime()} className="text-xs text-text-tertiary" style={TABULAR}>
              {s.label}
              {/* « S36 » suivi de « S35 » se lirait comme une erreur : sur une
                  fenêtre à cheval sur deux années, l'année lève le doute. */}
              {bornesMemeAnnee ? '' : ` ’${String(s.lundi.getFullYear()).slice(2)}`}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

function LigneExercice({ exercice, dernier }: { exercice: ExerciceTravaille; dernier: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/progression/[id]', params: { id: exercice.exercise_id } })
      }
      className={`flex-row items-center px-4 py-4 active:opacity-80 ${
        dernier ? '' : 'border-b border-border'
      }`}>
      <View className="flex-1 pr-3">
        <Text className="text-base text-text-primary">{exercice.nom}</Text>
        <Text className="mt-0.5 text-sm text-text-tertiary" style={TABULAR}>
          {libelleDate(exercice.derniere)} · {libellePerf(exercice.charge_kg, exercice.reps)}
        </Text>
      </View>
      <Text className="text-base text-text-tertiary">›</Text>
    </Pressable>
  );
}

export default function ProgressionScreen() {
  const [date] = useState(() => new Date());
  const [periode, setPeriode] = useState<Periode>('6sem');
  const [etat, setEtat] = useState<Progression | null>(null);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(
    async (p: Periode) => {
      setErreur(false);
      setEtat(null);
      try {
        setEtat(await chargerProgression(p, date));
      } catch {
        setErreur(true);
      }
    },
    [date],
  );

  // Au retour d'une séance terminée : le volume et l'assiduité doivent bouger
  // sans relancer l'app.
  useFocusEffect(
    useCallback(() => {
      charger(periode);
    }, [charger, periode]),
  );

  const changerPeriode = (p: Periode) => {
    setPeriode(p);
    charger(p);
  };

  const assiduite =
    etat?.seances && etat.seances.total > 0
      ? `${Math.round((etat.seances.terminees / etat.seances.total) * 100)} % d’assiduité`
      : undefined;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
          <Text className="text-3xl font-bold text-text-primary">Progression</Text>

          <Selecteur periode={periode} onChange={changerPeriode} />

          {erreur ? (
            <View className="mt-8">
              <Text className="text-base text-text-secondary">
                Impossible de charger tes données. Vérifie ta connexion.
              </Text>
              <View className="mt-6">
                <Button
                  label="Réessayer"
                  variant="secondary"
                  onPress={() => charger(periode)}
                />
              </View>
            </View>
          ) : etat === null ? (
            <View className="mt-16 items-center">
              <ActivityIndicator />
            </View>
          ) : (
            <>
              <Card className="mt-6">
                <Text className="text-sm font-medium uppercase tracking-wide text-text-tertiary">
                  Volume total
                </Text>
                <View className="mt-1 flex-row items-baseline">
                  <Text className="text-5xl font-bold text-text-primary" style={TABULAR}>
                    {libelleVolume(etat.volume_kg)}
                  </Text>
                  {etat.variation !== null ? (
                    <Text
                      className={`ml-3 text-base ${
                        etat.variation >= 0 ? 'text-accent' : 'text-text-secondary'
                      }`}
                      style={TABULAR}>
                      {etat.variation >= 0 ? '+' : '−'}
                      {pourcent(Math.abs(etat.variation))}
                    </Text>
                  ) : null}
                </View>
                <Text className="mt-1 text-sm text-text-tertiary">
                  {etat.variation === null
                    ? 'Comparaison disponible après deux semaines complètes'
                    : 'Par rapport à la période précédente'}
                </Text>
              </Card>

              {etat.seances ? (
                <View className="mt-3">
                  <StatBlock
                    label="Séances"
                    value={`${etat.seances.terminees} / ${etat.seances.total}`}
                    delta={assiduite}
                  />
                </View>
              ) : null}

              <Titre texte="Volume par semaine" />
              <VolumeParSemaine semaines={etat.semaines} />

              <Titre texte="Exercices" />
              {etat.exercices.length === 0 ? (
                <Card>
                  <Text className="text-base text-text-secondary">
                    Aucun exercice enregistré sur cette période.
                  </Text>
                </Card>
              ) : (
                <Card className="p-0">
                  {etat.exercices.map((e, i) => (
                    <LigneExercice
                      key={e.exercise_id}
                      exercice={e}
                      dernier={i === etat.exercices.length - 1}
                    />
                  ))}
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
