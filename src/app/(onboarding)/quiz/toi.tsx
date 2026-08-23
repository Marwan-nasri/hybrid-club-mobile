import { useState } from 'react';
import { Text, View } from 'react-native';

import { EcranQuestion } from '@/components/quiz/EcranQuestion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useEtapeQuiz } from '@/lib/quiz';

const BORNES = { poids: [30, 250], taille: [120, 230] } as const;

const nombre = (saisie: string): number | null => {
  const n = Number(saisie.replace(',', '.'));
  return saisie.trim() === '' || Number.isNaN(n) ? null : n;
};

const dansBornes = (n: number | null, [bas, haut]: readonly [number, number]) =>
  n === null || (n >= bas && n <= haut);

/** « 14/03/1991 » → « 1991-03-14 », comme la colonne `profiles.date_naissance`. */
const dateIso = (saisie: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(saisie.trim());
  if (!m) return null;
  const [, jour, mois, annee] = m;
  const iso = `${annee}-${mois}-${jour}`;
  // Date rejette « 2000-02-31 » : inutile de recompter les jours du mois.
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
};

export default function ToiScreen() {
  const { position, total, suivant } = useEtapeQuiz();
  const [prenom, setPrenom] = useState('');
  const [poids, setPoids] = useState('');
  const [taille, setTaille] = useState('');
  const [naissance, setNaissance] = useState('');

  const poidsKg = nombre(poids);
  const tailleCm = nombre(taille);
  const dateSaisie = naissance.trim() !== '';

  const invalide =
    !dansBornes(poidsKg, BORNES.poids) ||
    !dansBornes(tailleCm, BORNES.taille) ||
    (dateSaisie && dateIso(naissance) === null);

  return (
    <EcranQuestion
      question="Pour finir, toi."
      aide="Tout est optionnel. Rien ici n'entre dans le calcul de ton programme — c'est pour te suivre dans le temps."
      position={position}
      total={total}>
      <View className="gap-4">
        <Input label="Prénom" value={prenom} onChangeText={setPrenom} placeholder="Thomas" />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input
              label="Poids (kg)"
              value={poids}
              onChangeText={setPoids}
              keyboardType="decimal-pad"
              placeholder="78,4"
            />
          </View>
          <View className="flex-1">
            <Input
              label="Taille (cm)"
              value={taille}
              onChangeText={setTaille}
              keyboardType="number-pad"
              placeholder="181"
            />
          </View>
        </View>
        <Input
          label="Date de naissance"
          value={naissance}
          onChangeText={setNaissance}
          keyboardType="number-pad"
          placeholder="14/03/1991"
        />
      </View>

      {invalide ? (
        <Text className="mt-3 text-sm text-text-secondary">
          Vérifie ce que tu as saisi : poids entre {BORNES.poids[0]} et {BORNES.poids[1]} kg,
          taille entre {BORNES.taille[0]} et {BORNES.taille[1]} cm, date au format JJ/MM/AAAA.
        </Text>
      ) : null}

      <View className="mt-8 gap-3">
        <Button
          label="Voir mon plan"
          disabled={invalide}
          onPress={() =>
            suivant({
              prenom: prenom.trim() || null,
              poids_kg: poidsKg,
              taille_cm: tailleCm,
              date_naissance: dateSaisie ? dateIso(naissance) : null,
            })
          }
        />
        <Button label="Passer" variant="secondary" onPress={() => suivant({})} />
      </View>
    </EcranQuestion>
  );
}
