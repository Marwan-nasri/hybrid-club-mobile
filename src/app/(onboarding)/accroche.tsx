import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';

/**
 * Douze semaines de charge, les trois barres accent étant les semaines de test.
 * Décoratif : c'est la silhouette d'un bloc (montée, décharge, retest), pas une
 * donnée de l'utilisateur — il n'en a encore aucune.
 */
const BLOC = [28, 40, 34, 52, 46, 62, 74, 58, 70, 66, 80, 96];
const SEMAINES_DE_TEST = [3, 6, 11];

export default function AccrocheScreen() {
  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1 px-5" edges={['top', 'bottom']}>
        <Text className="mt-2 text-sm font-medium uppercase tracking-wide text-text-tertiary">
          Hybrid Club
        </Text>

        <View className="mt-8 flex-1 flex-row items-end gap-2" accessibilityElementsHidden>
          {BLOC.map((hauteur, i) => (
            <View
              key={i}
              className={`flex-1 rounded-sm ${
                SEMAINES_DE_TEST.includes(i) ? 'bg-accent' : 'bg-surface-elevated'
              }`}
              style={{ height: `${hauteur}%` }}
            />
          ))}
        </View>

        <View className="mt-12">
          <Text className="text-3xl font-bold text-text-primary">
            Fort et endurant.{'\n'}Sans choisir.
          </Text>
          <Text className="mt-3 text-base text-text-secondary">
            Un bloc de 12 semaines qui planifie ta force et ton cardio ensemble, et se recalcule sur
            tes vraies performances.
          </Text>

          <View className="mt-8">
            <Button label="Commencer" onPress={() => router.push('/quiz/objectif')} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
