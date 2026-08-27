import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { phaseDeSemaine } from '@/lib/programme';
import { chargerBloc, chargerSemaineBloc } from '@/lib/seances';

import type { BlocProgramme, EtatBloc, JourProgramme } from '@/lib/seances';

const ABREVIATIONS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

/** « 5h20 » — le cumul des durées estimées de la semaine. */
function libelleDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

function Entete({ bloc }: { bloc: BlocProgramme }) {
  const phase = phaseDeSemaine(bloc.niveau, bloc.semaine_courante);
  const progression =
    bloc.total_seances === 0 ? 0 : bloc.seances_terminees / bloc.total_seances;

  return (
    <>
      <Text className="text-3xl font-bold text-text-primary">{bloc.nom}</Text>

      <Card className="mt-6">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm font-medium uppercase tracking-wide text-text-tertiary">
            Progression du bloc
          </Text>
          <Text
            className="text-xl font-semibold text-text-primary"
            style={{ fontVariant: ['tabular-nums'] }}>
            {bloc.seances_terminees} / {bloc.total_seances} séances
          </Text>
        </View>

        <View className="mt-3 h-1 rounded-pill bg-border">
          <View
            className="h-1 rounded-pill bg-accent"
            style={{ width: `${Math.round(progression * 100)}%` }}
          />
        </View>

        <Text className="mt-3 text-sm text-text-secondary">
          {bloc.hors_bloc
            ? `Bloc de ${bloc.duree_semaines} semaines terminé`
            : `Semaine ${bloc.semaine_courante} sur ${bloc.duree_semaines}${
                phase ? ` · phase ${phase}` : ''
              }`}
        </Text>
      </Card>
    </>
  );
}

/**
 * Une ligne de jour. Un jour de repos n'a pas de séance à ouvrir : il reste
 * inerte plutôt que d'emmener sur un détail vide.
 */
function LigneJour({
  jour,
  aujourdhui,
  dernier,
}: {
  jour: JourProgramme;
  aujourdhui: boolean;
  dernier: boolean;
}) {
  const bordure = dernier ? '' : 'border-b border-border';

  if (!jour.session) {
    return (
      <View className={`flex-row items-center px-4 py-4 ${bordure}`}>
        <Text className="w-12 text-sm font-medium uppercase tracking-wide text-text-tertiary">
          {ABREVIATIONS[jour.jour - 1]}
        </Text>
        <Text className="flex-1 text-base text-text-tertiary">Repos</Text>
      </View>
    );
  }

  const termine = jour.statut === 'termine';
  const detail = [
    jour.session.duree_estimee_min ? `${jour.session.duree_estimee_min} min` : null,
    jour.statut === 'en_cours' ? 'en cours' : aujourdhui ? "aujourd'hui" : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/programme/[id]', params: { id: jour.session!.id } })
      }
      className={`flex-row items-center px-4 py-4 active:opacity-80 ${bordure}`}>
      <Text
        className={`w-12 text-sm font-medium uppercase tracking-wide ${
          aujourdhui ? 'text-accent' : 'text-text-tertiary'
        }`}>
        {ABREVIATIONS[jour.jour - 1]}
      </Text>

      <View className="flex-1 pr-3">
        <Text className={`text-base ${termine ? 'text-text-secondary' : 'text-text-primary'}`}>
          {jour.session.nom}
        </Text>
        {detail ? <Text className="mt-0.5 text-sm text-text-tertiary">{detail}</Text> : null}
      </View>

      {termine ? (
        <View className="h-6 w-6 items-center justify-center rounded-pill bg-accent">
          <Text className="text-xs font-bold text-background">✓</Text>
        </View>
      ) : (
        <Text className="text-base text-text-tertiary">›</Text>
      )}
    </Pressable>
  );
}

function Repli({ titre, message, action }: { titre: string; message: string; action?: () => void }) {
  return (
    <View className="flex-1 justify-center px-5">
      <Text className="text-3xl font-bold text-text-primary">{titre}</Text>
      <Text className="mt-3 text-base text-text-secondary">{message}</Text>
      {action ? (
        <View className="mt-6">
          <Button label="Réessayer" variant="secondary" onPress={action} />
        </View>
      ) : null}
    </View>
  );
}

export default function ProgrammeScreen() {
  const [date] = useState(() => new Date());
  const [etat, setEtat] = useState<EtatBloc | null>(null);
  const [semaine, setSemaine] = useState<number | null>(null);
  const [jours, setJours] = useState<JourProgramme[] | null>(null);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [erreur, setErreur] = useState(false);

  // La semaine choisie vit aussi dans une ref : le rechargement au retour de
  // focus doit la relire sans se réabonner à chaque changement de semaine, ce
  // qui le ferait repartir sur la semaine courante à chaque aller-retour.
  const semaineChoisie = useRef<number | null>(null);

  const charger = useCallback(async () => {
    setErreur(false);
    try {
      const resultat = await chargerBloc(date);
      setEtat(resultat);
      if (resultat.statut !== 'ok') return;

      const n = semaineChoisie.current ?? resultat.bloc.semaine_courante;
      semaineChoisie.current = n;
      setSemaine(n);
      setJours(await chargerSemaineBloc(resultat.bloc.id, n));
    } catch {
      setErreur(true);
    }
  }, [date]);

  // Au retour de l'écran de séance : une séance terminée entre-temps doit
  // apparaître dans la progression sans relancer l'app.
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const changerSemaine = useCallback(
    async (n: number) => {
      if (etat?.statut !== 'ok') return;
      setChoixOuvert(false);
      semaineChoisie.current = n;
      setSemaine(n);
      setJours(null);
      try {
        setJours(await chargerSemaineBloc(etat.bloc.id, n));
      } catch {
        setErreur(true);
      }
    },
    [etat],
  );

  if (erreur) {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1">
          <Repli
            titre="Programme indisponible"
            message="Impossible de récupérer ton bloc. Vérifie ta connexion."
            action={charger}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (etat === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (etat.statut === 'sans_programme') {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1">
          <Repli
            titre="Aucun programme actif"
            message="Ton programme n’a pas été enregistré. Reprends l’onboarding pour le régénérer."
          />
        </SafeAreaView>
      </View>
    );
  }

  const { bloc } = etat;
  const seances = (jours ?? []).filter((j) => j.session !== null);
  const minutes = seances.reduce((t, j) => t + (j.session?.duree_estimee_min ?? 0), 0);
  const phase = semaine === null ? null : phaseDeSemaine(bloc.niveau, semaine);

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
          <Entete bloc={bloc} />

          <Card className="mt-6 p-0">
            <Pressable
              accessibilityRole="button"
              onPress={() => setChoixOuvert(true)}
              className="flex-row items-center px-4 py-4 active:opacity-80">
              <View className="flex-1">
                <Text className="text-xl font-semibold text-text-primary">
                  Semaine {semaine ?? bloc.semaine_courante}
                </Text>
                <Text className="mt-0.5 text-sm text-text-secondary">
                  {[
                    phase,
                    `${seances.length} ${seances.length === 1 ? 'séance' : 'séances'}`,
                    minutes > 0 ? libelleDuree(minutes) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text className="text-base text-text-tertiary">⌄</Text>
            </Pressable>

            {jours === null ? (
              <View className="items-center border-t border-border py-8">
                <ActivityIndicator />
              </View>
            ) : (
              <View className="border-t border-border">
                {jours.map((j, i) => (
                  <LigneJour
                    key={j.jour}
                    jour={j}
                    aujourdhui={!bloc.hors_bloc && semaine === bloc.semaine_courante && j.jour === bloc.jour}
                    dernier={i === jours.length - 1}
                  />
                ))}
              </View>
            )}
          </Card>
        </ScrollView>

        <Sheet visible={choixOuvert} onClose={() => setChoixOuvert(false)} title="Semaine">
          <View className="flex-row flex-wrap gap-2">
            {Array.from({ length: bloc.duree_semaines }, (_, i) => i + 1).map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                onPress={() => changerSemaine(n)}
                className={`h-14 w-[15%] grow items-center justify-center rounded-card border active:opacity-80 ${
                  n === semaine ? 'border-accent' : 'border-border'
                }`}>
                <Text
                  className={`text-base font-semibold ${
                    n === semaine ? 'text-accent' : 'text-text-secondary'
                  }`}>
                  S{n}
                </Text>
              </Pressable>
            ))}
          </View>
        </Sheet>
      </SafeAreaView>
    </View>
  );
}
