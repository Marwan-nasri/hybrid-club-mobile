import { Text, View } from 'react-native';

type StatBlockProps = {
  label: string;
  value: string;
  /** Ex. « +2,5 kg » ou « -12 s ». Le signe détermine la couleur. */
  delta?: string;
};

const TABULAR = { fontVariant: ['tabular-nums' as const] };

export function StatBlock({ label, value, delta }: StatBlockProps) {
  return (
    <View className="rounded-card border border-border bg-surface p-4">
      <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</Text>
      <Text className="mt-1 text-2xl font-bold text-text-primary" style={TABULAR}>
        {value}
      </Text>
      {delta ? (
        <Text
          className={`mt-1 text-xs ${delta.startsWith('+') ? 'text-accent' : 'text-text-secondary'}`}
          style={TABULAR}>
          {delta}
        </Text>
      ) : null}
    </View>
  );
}
