import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ReactNode } from 'react';

/**
 * Le châssis commun à tous les écrans de question : barre de progression,
 * retour, titre, corps, légende. Ce n'est pas un 7e composant de base — c'est
 * un gabarit d'écran, il ne descend pas dans `components/ui/`.
 *
 * Le corps est un slot : les choix simples y mettent `<ChoixSimple>`, les
 * saisies numériques y mettent leurs `Input` et leur bouton « Continuer ».
 */
type EcranQuestionProps = {
  question: string;
  /** Sous-titre sous la question (A3, A4 en ont un). */
  aide?: string;
  position: number;
  total: number;
  /** Note de bas d'écran, hors zone de défilement. */
  legende?: string;
  children: ReactNode;
};

export function EcranQuestion({
  question,
  aide,
  position,
  total,
  legende,
  children,
}: EcranQuestionProps) {
  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-row items-center gap-4 px-5 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Revenir à la question précédente"
            hitSlop={16}
            onPress={() => router.back()}
            className="h-12 w-6 justify-center active:opacity-60">
            <Text className="text-2xl text-text-secondary">‹</Text>
          </Pressable>

          <View className="h-0.5 flex-1 overflow-hidden rounded-pill bg-border">
            <View
              className="h-full rounded-pill bg-accent"
              style={{ width: `${(position / total) * 100}%` }}
            />
          </View>

          <Text
            className="text-xs text-text-tertiary"
            style={{ fontVariant: ['tabular-nums'] }}>
            {position} / {total}
          </Text>
        </View>

        <ScrollView
          className="px-5"
          contentContainerClassName="pb-8"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled">
          <Text className="mt-8 text-3xl font-bold text-text-primary">{question}</Text>
          {aide ? <Text className="mt-3 text-base text-text-secondary">{aide}</Text> : null}
          <View className="mt-8">{children}</View>
        </ScrollView>

        {legende ? (
          <Text className="px-5 pb-2 pt-3 text-center text-xs text-text-tertiary">{legende}</Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
