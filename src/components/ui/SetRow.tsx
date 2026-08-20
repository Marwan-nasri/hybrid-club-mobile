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
          selectTextOnFocus
          className={`h-14 text-2xl font-bold ${valueColor}`}
          style={TABULAR}
        />
        <Text className="ml-1 text-sm text-text-tertiary">kg</Text>
      </View>

      <View className="flex-1 flex-row items-baseline">
        <TextInput
          value={reps}
          onChangeText={onChangeReps}
          keyboardType="number-pad"
          selectTextOnFocus
          className={`h-14 text-2xl font-bold ${valueColor}`}
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
