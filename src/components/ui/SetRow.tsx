import * as Haptics from 'expo-haptics';
import { Pressable, Text, TextInput, View } from 'react-native';

type SetRowProps = {
  /** Numéro de série affiché (1-indexé). */
  index: number;
  weight: string;
  reps: string;
  validated: boolean;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  onValidate: () => void;
};

const TABULAR = { fontVariant: ['tabular-nums' as const] };

// Sans largeur explicite, iOS dimensionne le champ sur son contenu mesuré —
// avec un temps de retard. Une charge à trois chiffres plus décimale
// (« 142,5 ») sortait tronquée à « 142 », et un champ vide (exercice jamais
// fait) tombait à zéro de large : plus rien à toucher pour saisir la charge.
// Ces largeurs tiennent la valeur la plus longue que `maxLength` autorise.
const LARGEUR_CHARGE = 'w-20'; // « 142,5 » en text-2xl bold tabular
const LARGEUR_REPS = 'w-12'; // trois chiffres

export function SetRow({
  index,
  weight,
  reps,
  validated,
  onChangeWeight,
  onChangeReps,
  onValidate,
}: SetRowProps) {
  // Tant que la série n'est pas validée, les valeurs sont celles de la séance
  // précédente : affichées en gris, l'utilisateur ajuste ou valide tel quel.
  const valueColor = validated ? 'text-text-primary' : 'text-text-tertiary';

  const handleValidate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onValidate();
  };

  return (
    <View className="min-h-[74px] flex-row items-center rounded-card border border-border bg-surface-elevated px-3">
      <Text className="w-8 text-base text-text-tertiary" style={TABULAR}>
        {index}
      </Text>

      <View className="flex-1 flex-row items-baseline">
        <TextInput
          value={weight}
          onChangeText={onChangeWeight}
          keyboardType="decimal-pad"
          maxLength={5}
          selectTextOnFocus
          className={`h-14 ${LARGEUR_CHARGE} text-2xl font-bold ${valueColor}`}
          style={TABULAR}
        />
        <Text className="ml-1 text-sm text-text-tertiary">kg</Text>
      </View>

      <View className="flex-1 flex-row items-baseline">
        <TextInput
          value={reps}
          onChangeText={onChangeReps}
          keyboardType="number-pad"
          maxLength={3}
          selectTextOnFocus
          className={`h-14 ${LARGEUR_REPS} text-2xl font-bold ${valueColor}`}
          style={TABULAR}
        />
        <Text className="ml-1 text-sm text-text-tertiary">reps</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Valider la série ${index}`}
        onPress={handleValidate}
        className={`h-16 w-[72px] items-center justify-center rounded-sheet active:opacity-80 ${
          validated ? 'bg-accent' : 'border border-border'
        }`}>
        <Text className={`text-xl ${validated ? 'text-background' : 'text-text-tertiary'}`}>✓</Text>
      </Pressable>
    </View>
  );
}
