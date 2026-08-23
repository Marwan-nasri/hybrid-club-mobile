import { useState } from 'react';
import { Text, View } from 'react-native';

import { EcranQuestion } from '@/components/quiz/EcranQuestion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useEtapeQuiz } from '@/lib/quiz';

/** Un 5 km se court entre ces bornes ; au-delà, c'est une faute de frappe. */
const MIN_SEC = 12 * 60;
const MAX_SEC = 60 * 60;

const entier = (saisie: string): number | null => {
  const n = Number(saisie);
  return saisie.trim() === '' || !Number.isInteger(n) || n < 0 ? null : n;
};

export default function Temps5kScreen() {
  const { position, total, suivant } = useEtapeQuiz();
  const [minutes, setMinutes] = useState('');
  const [secondes, setSecondes] = useState('');

  const min = entier(minutes);
  const sec = entier(secondes) ?? 0;
  const enSecondes = min === null ? null : min * 60 + sec;

  const valide =
    enSecondes !== null && sec < 60 && enSecondes >= MIN_SEC && enSecondes <= MAX_SEC;

  return (
    <EcranQuestion
      question="Ton temps sur 5 km ?"
      aide="Ton meilleur effort récent, même approximatif. C'est ce qui cale les allures de tes séances de course."
      position={position}
      total={total}
      legende="Les allures se réajusteront sur tes premières sorties.">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label="Minutes"
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            placeholder="24"
          />
        </View>
        <View className="flex-1">
          <Input
            label="Secondes"
            value={secondes}
            onChangeText={setSecondes}
            keyboardType="number-pad"
            placeholder="30"
          />
        </View>
      </View>

      {minutes.trim() !== '' && !valide ? (
        <Text className="mt-3 text-sm text-text-secondary">
          Entre {MIN_SEC / 60} et {MAX_SEC / 60} minutes, secondes en dessous de 60.
        </Text>
      ) : null}

      <View className="mt-8 gap-3">
        <Button
          label="Continuer"
          disabled={!valide}
          onPress={() => suivant({ temps_5k_sec: enSecondes })}
        />
        <Button
          label="Je ne le connais pas"
          variant="secondary"
          onPress={() => suivant({ temps_5k_sec: null })}
        />
      </View>
    </EcranQuestion>
  );
}
