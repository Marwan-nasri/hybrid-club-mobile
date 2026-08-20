import { useState } from 'react';
import { KeyboardTypeOptions, Text, TextInput, View } from 'react-native';

type InputProps = {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
};

export function Input({ value, onChangeText, label, placeholder, keyboardType }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label ? (
        <Text className="mb-2 text-sm font-medium uppercase tracking-wide text-text-tertiary">
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`min-h-14 rounded-card border bg-surface px-4 text-base text-text-primary placeholder:text-text-tertiary ${
          focused ? 'border-accent' : 'border-border'
        }`}
      />
    </View>
  );
}
