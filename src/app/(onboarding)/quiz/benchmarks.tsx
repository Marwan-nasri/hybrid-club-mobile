import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import type { TextStyle } from 'react-native';

import { EcranQuestion } from '@/components/quiz/EcranQuestion';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useEtapeQuiz } from '@/lib/quiz';

type CleLift = 'squat_1rm' | 'bench_1rm' | 'deadlift_1rm';

const LIFTS: { cle: CleLift; nom: string }[] = [
  { cle: 'squat_1rm', nom: 'Squat' },
  { cle: 'bench_1rm', nom: 'Développé couché' },
  { cle: 'deadlift_1rm', nom: 'Soulevé de terre' },
];

const PAS = [-2.5, 2.5, 10];

/**
 * Ces charges pilotent les kilos affichés en séance. Une faute de frappe
 * (1250 au lieu de 125) sortirait un programme dangereux : hors de ces bornes,
 * on bloque plutôt que d'écrire la valeur.
 */
const MIN_PLAUSIBLE = 20;
const MAX_PLAUSIBLE = 400;

const VIDE: Record<CleLift, string> = { squat_1rm: '', bench_1rm: '', deadlift_1rm: '' };

/**
 * Le champ et son état vide partagent exactement ces métriques.
 *
 * Le placeholder natif d'iOS ignore la taille de police du TextInput — même
 * posée en style inline : le tiret sortait deux fois trop petit et la carte
 * changeait de hauteur entre vide et rempli. L'état vide est donc un vrai
 * `Text`, et la hauteur du champ est fixée par `lineHeight` des deux côtés.
 */
const CHIFFRE: TextStyle = {
  fontSize: 48,
  fontWeight: '700',
  textAlign: 'right',
  fontVariant: ['tabular-nums'],
};

/**
 * Le tiret d'état vide : mêmes métriques que la valeur saisie, plus un
 * interligne égal à la police. Le TextInput centre son texte dans son cadre,
 * un Text le pose sur sa baseline — sans ce `lineHeight`, le tiret tombait
 * 22 px sous les chiffres (mesuré à la capture ; il en reste 4).
 */
const TIRET: TextStyle = { ...CHIFFRE, lineHeight: CHIFFRE.fontSize };

/** Saisie française : « 122,5 » est ce que les gens tapent. */
const nombre = (saisie: string): number | null => {
  const n = Number(saisie.replace(',', '.'));
  return saisie.trim() === '' || Number.isNaN(n) ? null : n;
};

const texte = (n: number) => String(n).replace('.', ',');

export default function BenchmarksScreen() {
  const { position, total, suivant } = useEtapeQuiz();
  const [valeurs, setValeurs] = useState(VIDE);
  const [actif, setActif] = useState<CleLift>('squat_1rm');

  const ajuster = (pas: number) => {
    Haptics.selectionAsync();
    setValeurs((v) => ({
      ...v,
      [actif]: texte(Math.max(0, (nombre(v[actif]) ?? 0) + pas)),
    }));
  };

  const saisies = LIFTS.map((l) => nombre(valeurs[l.cle]));
  const horsBornes = saisies.some(
    (n) => n !== null && (n < MIN_PLAUSIBLE || n > MAX_PLAUSIBLE),
  );
  const rienSaisi = saisies.every((n) => n === null);

  const valider = () =>
    suivant({
      squat_1rm: nombre(valeurs.squat_1rm),
      bench_1rm: nombre(valeurs.bench_1rm),
      deadlift_1rm: nombre(valeurs.deadlift_1rm),
    });

  return (
    <EcranQuestion
      question="Tes charges actuelles"
      aide="Ton 1RM estimé, ou ta meilleure série récente. On ajustera dès la première séance."
      position={position}
      total={total}
      legende="Une séance de calibration remplacera cette étape.">
      <View className="gap-3">
        {LIFTS.map(({ cle, nom }) => (
          <Card
            key={cle}
            onPress={() => setActif(cle)}
            className={`flex-row items-center ${actif === cle ? '!border-accent' : ''}`}>
            <Text className="flex-1 text-base font-semibold text-text-primary">{nom}</Text>
            <View className="h-14 w-28">
              <TextInput
                value={valeurs[cle]}
                onChangeText={(v) => setValeurs((actuelles) => ({ ...actuelles, [cle]: v }))}
                onFocus={() => setActif(cle)}
                keyboardType="decimal-pad"
                maxLength={5}
                className="flex-1 text-text-primary"
                style={CHIFFRE}
              />
              {valeurs[cle] === '' ? (
                <View
                  className="absolute inset-0 justify-center"
                  style={{ pointerEvents: 'none' }}>
                  <Text className="text-text-tertiary" style={TIRET}>
                    —
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="ml-2 text-sm text-text-tertiary">kg</Text>
          </Card>
        ))}
      </View>

      <View className="mt-3 flex-row gap-3">
        {PAS.map((pas) => (
          <Card key={pas} onPress={() => ajuster(pas)} className="flex-1 items-center">
            <Text className="text-base font-semibold text-text-primary">
              {pas > 0 ? '+' : '−'}
              {texte(Math.abs(pas))}
            </Text>
          </Card>
        ))}
      </View>

      {horsBornes ? (
        <Text className="mt-3 text-sm text-text-secondary">
          Une charge doit tenir entre {MIN_PLAUSIBLE} et {MAX_PLAUSIBLE} kg. Vérifie la valeur.
        </Text>
      ) : null}

      <View className="mt-8 gap-3">
        <Button label="Continuer" disabled={rienSaisi || horsBornes} onPress={valider} />
        <Button
          label="Je ne sais pas — teste-moi"
          variant="secondary"
          onPress={() =>
            suivant({ squat_1rm: null, bench_1rm: null, deadlift_1rm: null })
          }
        />
      </View>
    </EcranQuestion>
  );
}
