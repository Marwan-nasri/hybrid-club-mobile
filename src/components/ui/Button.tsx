import { Pressable, Text } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
};

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-surface border border-border',
  ghost: '',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-background font-bold',
  secondary: 'text-text-primary font-semibold',
  ghost: 'text-text-secondary font-medium',
};

export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  // Un bouton désactivé quitte son variant : appliquer opacity-40 à bg-accent
  // vire à l'olive sur fond sombre et se lit comme une autre couleur.
  const container = disabled ? 'bg-surface border border-border' : `${CONTAINER[variant]} active:opacity-80`;
  const labelStyle = disabled ? 'text-text-tertiary font-semibold' : LABEL[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`min-h-14 flex-row items-center justify-center rounded-card px-6 ${container}`}>
      <Text className={`text-base ${labelStyle}`}>{label}</Text>
    </Pressable>
  );
}
