import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';

export type Option<T> = {
  valeur: T;
  titre: string;
  /** La ligne d'explication de la maquette — ce qui distingue vraiment les options. */
  description?: string;
};

type ChoixSimpleProps<T> = {
  options: Option<T>[];
  onSelect: (valeur: T) => void;
};

/**
 * Liste d'options à réponse unique : la sélection vaut validation, l'écran
 * enchaîne tout seul.
 */
export function ChoixSimple<T extends string | number>({
  options,
  onSelect,
}: ChoixSimpleProps<T>) {
  const [choix, setChoix] = useState<T | null>(null);

  const choisir = (valeur: T) => {
    // Deuxième tap pendant la transition : la navigation est déjà lancée,
    // la laisser passer empilerait deux fois l'écran suivant.
    if (choix !== null) return;
    setChoix(valeur);
    Haptics.selectionAsync();
    // L'utilisateur doit voir ce qu'il a choisi avant que l'écran parte.
    setTimeout(() => onSelect(valeur), 120);
  };

  return (
    <View className="gap-3">
      {options.map((o) => (
        <Card
          key={String(o.valeur)}
          onPress={() => choisir(o.valeur)}
          className={`min-h-14 justify-center ${choix === o.valeur ? '!border-accent' : ''}`}>
          <Text className="text-base font-semibold text-text-primary">{o.titre}</Text>
          {o.description ? (
            <Text className="mt-1 text-sm text-text-secondary">{o.description}</Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}
