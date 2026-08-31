import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SetRow } from '@/components/ui/SetRow';
import {
  chargerSeance,
  demarrerSeance,
  enregistrerSerie,
  etatSeance,
  supprimerSerie,
  terminerSeance,
} from '@/lib/seanceLive';
import { decoderCle } from '@/lib/seanceLocale';

import type { Bloc, BlocExercice, SeanceLive } from '@/lib/seanceLive';
import type { EtatSeance } from '@/lib/seanceLocale';

type SetState = { weight: string; reps: string; validated: boolean };

/** « 92.5 » → « 92,5 ». L'app affiche la virgule, la base stocke le point. */
function versAffichage(n: number | null): string {
  return n === null ? '' : String(n).replace('.', ',');
}

function versNombre(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return v.trim() === '' || Number.isNaN(n) ? null : n;
}

/**
 * Pré-remplissage d'une ligne de série.
 *
 * La charge vient de la dernière fois sur cet exercice, jamais de la
 * prescription : `session_blocks` ne stocke que `pct_1rm`. Sans historique, le
 * champ reste vide — mieux qu'une valeur inventée que l'utilisateur validerait
 * sans regarder.
 */
function prerempli(bloc: BlocExercice): SetState[] {
  const repsPrescrites = bloc.reps_cible && /^\d+$/.test(bloc.reps_cible) ? bloc.reps_cible : '';
  return Array.from({ length: bloc.series }, () => ({
    weight: versAffichage(bloc.precedent?.charge_kg ?? null),
    reps: bloc.precedent?.reps ? String(bloc.precedent.reps) : repsPrescrites,
    validated: false,
  }));
}

/**
 * Recouvre le pré-remplissage avec ce qui a déjà été validé.
 *
 * Sans ça, l'app relancée en pleine séance repartait de séries vierges alors
 * que le réalisé existait — en base comme en local. Une série ajoutée à la
 * main au-delà du nombre prescrit est réintégrée : le tableau s'étend jusqu'au
 * plus grand numéro trouvé.
 */
function reprise(bloc: BlocExercice, etat: EtatSeance | null): SetState[] {
  const base = prerempli(bloc);
  const faites = Object.entries(etat?.series ?? {}).flatMap(([cle, valeurs]) => {
    const { exercise_id, serie } = decoderCle(cle);
    return valeurs && exercise_id === bloc.exercise_id
      ? [[serie, valeurs] as const]
      : [];
  });

  const total = Math.max(base.length, ...faites.map(([serie]) => serie));
  const lignes = Array.from(
    { length: total },
    (_, i) => base[i] ?? { weight: '', reps: '', validated: false },
  );

  for (const [serie, valeurs] of faites) {
    lignes[serie - 1] = {
      weight: versAffichage(valeurs.charge_kg),
      reps: valeurs.reps === null ? '' : String(valeurs.reps),
      validated: true,
    };
  }
  return lignes;
}

function formatChrono(secondes: number) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sousTitre(bloc: BlocExercice): string {
  return [
    `${bloc.series} séries`,
    bloc.reps_cible ? `${bloc.reps_cible} reps` : null,
    bloc.repos_sec ? `repos ${formatChrono(bloc.repos_sec)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function derniereFois(bloc: BlocExercice): string | null {
  const p = bloc.precedent;
  if (!p || p.charge_kg === null) return null;
  return `${p.series}×${p.reps ?? '?'} @ ${versAffichage(p.charge_kg)} kg`;
}

function Repli({ titre, message }: { titre: string; message: string }) {
  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1 justify-center px-5">
        <Text className="text-3xl font-bold text-text-primary">{titre}</Text>
        <Text className="mt-3 text-base text-text-secondary">{message}</Text>
        <View className="mt-8">
          <Button label="Retour" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Bloc cardio : affiché pour ne rien cacher de la séance, mais pas enregistré. */
function CarteCardio({ bloc }: { bloc: Extract<Bloc, { kind: 'cardio' }> }) {
  return (
    <Card className="mt-8">
      <Text className="text-base text-text-secondary">{bloc.detail ?? 'Bloc libre'}</Text>
      <Text className="mt-3 text-sm text-text-tertiary">
        Ce bloc n&apos;est pas encore chronométré dans l&apos;app — note-le de ton côté.
      </Text>
    </Card>
  );
}

export default function WorkoutScreen() {
  // L'écran reste allumé pendant toute la séance.
  useKeepAwake();

  const { id } = useLocalSearchParams<{ id: string }>();

  const [seance, setSeance] = useState<SeanceLive | null>(null);
  // Un `client_uuid`, pas l'`id` de `workout_logs` : celui-ci n'existe qu'après
  // la première synchronisation, et la séance doit tourner sans.
  const [clientUuid, setClientUuid] = useState<string | null>(null);
  const [debutMs, setDebutMs] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);
  const [seriesParBloc, setSeriesParBloc] = useState<SetState[][]>([]);
  const [indexBloc, setIndexBloc] = useState(0);
  const [chrono, setChrono] = useState(0);
  const [cloture, setCloture] = useState(false);

  const demarre = useRef(false);

  useEffect(() => {
    if (!id || demarre.current) return;
    demarre.current = true;
    (async () => {
      try {
        const donnees = await chargerSeance(id);
        const uuid = await demarrerSeance(id);
        const etat = await etatSeance(uuid);
        setSeance(donnees);
        setSeriesParBloc(donnees.blocs.map((b) => (b.kind === 'exercice' ? reprise(b, etat) : [])));
        setClientUuid(uuid);
        setDebutMs(etat ? Date.parse(etat.debut_iso) : Date.now());
      } catch {
        setEchec(true);
      }
    })();
  }, [id]);

  // Le chrono part de `debut_iso`, pas de l'ouverture de l'écran : une séance
  // reprise après un crash repartait sinon de zéro.
  useEffect(() => {
    if (debutMs === null) return;
    const maj = () => setChrono(Math.max(0, Math.round((Date.now() - debutMs) / 1000)));
    maj();
    const timer = setInterval(maj, 1000);
    return () => clearInterval(timer);
  }, [debutMs]);

  const majSerie = useCallback(
    (index: number, patch: Partial<SetState>) =>
      setSeriesParBloc((tout) =>
        tout.map((bloc, i) =>
          i === indexBloc ? bloc.map((s, j) => (j === index ? { ...s, ...patch } : s)) : bloc,
        ),
      ),
    [indexBloc],
  );

  if (echec) {
    return (
      <Repli
        titre="Séance introuvable"
        message="Impossible de charger cette séance. Vérifie ta connexion et réessaie."
      />
    );
  }

  if (!seance) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  const bloc = seance.blocs[indexBloc];
  const series = seriesParBloc[indexBloc] ?? [];
  const suivant = seance.blocs[indexBloc + 1];
  const exercice = bloc?.kind === 'exercice' ? bloc : null;

  const validees = series.filter((s) => s.validated).length;
  const progression =
    ((indexBloc + (series.length ? validees / series.length : 0)) / seance.blocs.length) * 100;

  /**
   * Valide ou dévalide une série, et la répercute en base.
   *
   * L'état bascule d'abord — le retour haptique est déjà parti, revenir en
   * arrière visuellement serait pire que d'attendre. Le réseau n'intervient
   * plus ici : `enregistrerSerie` écrit l'état local et rend la main, la
   * synchronisation part en tâche de fond. Une coupure ne peut donc plus faire
   * échouer une validation. L'erreur qui reste est un échec d'écriture locale ;
   * on annule la bascule et on le dit, une série qu'on croit enregistrée et qui
   * ne l'est pas c'est une séance perdue.
   */
  const basculerSerie = async (index: number) => {
    if (!exercice || !clientUuid) return;
    const avant = series[index];
    const valide = !avant.validated;
    majSerie(index, { validated: valide });
    setErreur(null);

    try {
      if (valide) {
        await enregistrerSerie(clientUuid, {
          exercise_id: exercice.exercise_id,
          serie: index + 1,
          reps: versNombre(avant.reps),
          charge_kg: versNombre(avant.weight),
          rpe: exercice.rpe,
        });
      } else {
        await supprimerSerie(clientUuid, exercice.exercise_id, index + 1);
      }
    } catch {
      majSerie(index, { validated: avant.validated });
      setErreur("Cette série n'a pas été enregistrée. Réessaie.");
    }
  };

  const terminer = async () => {
    if (!clientUuid || cloture) return;
    setCloture(true);
    setErreur(null);
    try {
      await terminerSeance(clientUuid, chrono);
      router.replace('/(tabs)');
    } catch {
      setCloture(false);
      setErreur("La séance n'a pas pu être clôturée. Réessaie.");
    }
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']}>
        <View className="flex-row items-center px-5 py-2">
          <Button label="‹" variant="ghost" onPress={() => router.back()} />
          <Text className="flex-1 text-center text-sm font-medium uppercase tracking-wide text-text-secondary">
            {seance.nom}
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
            Exercice {indexBloc + 1} / {seance.blocs.length}
          </Text>
          {exercice ? (
            <Text className="text-base text-text-secondary">
              {validees} / {series.length} séries validées
            </Text>
          ) : null}
        </View>
      </SafeAreaView>

      <ScrollView className="px-5" contentContainerClassName="pb-6">
        <Text className="mt-6 text-3xl font-bold text-text-primary">{bloc.nom}</Text>

        {exercice ? (
          <>
            <Text className="mt-2 text-xl text-text-secondary">{sousTitre(exercice)}</Text>

            {derniereFois(exercice) ? (
              <Card className="mt-4 self-start rounded-pill bg-surface-elevated px-4 py-2">
                <Text className="text-base text-text-secondary">
                  Dernière fois : {derniereFois(exercice)}
                </Text>
              </Card>
            ) : (
              <Text className="mt-4 text-base text-text-tertiary">
                Première fois sur cet exercice — choisis ta charge.
              </Text>
            )}

            {exercice.notes ? (
              <Text className="mt-3 text-sm text-warning">{exercice.notes}</Text>
            ) : null}

            <View className="mb-2 mt-8 flex-row px-3">
              <Text className="w-8 text-xs uppercase tracking-wide text-text-tertiary">Sér.</Text>
              <Text className="flex-1 text-xs uppercase tracking-wide text-text-tertiary">
                Charge
              </Text>
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
                  onValidate={() => basculerSerie(i)}
                />
              ))}
            </View>

            <View className="mt-3">
              <Button
                label="+ Ajouter une série"
                variant="secondary"
                onPress={() =>
                  setSeriesParBloc((tout) =>
                    tout.map((b, i) =>
                      i === indexBloc ? [...b, { ...b[b.length - 1], validated: false }] : b,
                    ),
                  )
                }
              />
            </View>
          </>
        ) : bloc.kind === 'cardio' ? (
          <CarteCardio bloc={bloc} />
        ) : null}

        {erreur ? (
          <View className="mt-4 rounded-card border border-border bg-surface p-4">
            <Text className="text-base text-text-primary">{erreur}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t border-border px-5 pt-3">
        <SafeAreaView edges={['bottom']}>
          <View className="flex-row gap-3">
            <Button
              label="‹"
              variant="secondary"
              disabled={indexBloc === 0}
              onPress={() => setIndexBloc((i) => i - 1)}
            />
            <Card
              className="flex-1 justify-center py-3"
              onPress={suivant ? () => setIndexBloc((i) => i + 1) : terminer}>
              <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                {suivant ? 'Suivant' : 'Dernier exercice'}
              </Text>
              <Text className="mt-1 text-xl font-semibold text-text-primary">
                {suivant ? suivant.nom : cloture ? 'Clôture…' : 'Terminer la séance'}
              </Text>
            </Card>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}
