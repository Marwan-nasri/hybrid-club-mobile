import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

type CardProps = {
  children: ReactNode;
  /** Classes fusionnées avec la base — permet aux écrans de composer sans nouveau composant. */
  className?: string;
  onPress?: () => void;
};

const BASE = 'bg-surface border border-border rounded-card p-4';

export function Card({ children, className = '', onPress }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className={`${BASE} active:opacity-80 ${className}`}>
        {children}
      </Pressable>
    );
  }

  return <View className={`${BASE} ${className}`}>{children}</View>;
}
