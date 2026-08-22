import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { estComplet, lireProfil } from '@/lib/profilOnboarding';
import { supabase } from '@/lib/supabase';

/**
 * Point d'atterrissage après l'onboarding — provisoire.
 *
 * TODO: remplacer par le vrai écran « Aujourd'hui » quand on attaquera les
 * 4 onglets. Il ne fait que confirmer que le compte et le programme existent.
 */
export default function AccueilScreen() {
  const [pret, setPret] = useState(false);

  // Un profil d'onboarding encore en attente alors qu'une session existe
  // signifie que l'insertion n'est jamais allée au bout — app tuée pendant le
  // chargement, typiquement. On repart sur l'écran qui sait la reprendre plutôt
  // que d'afficher un accueil qui ment sur l'état du compte.
  useEffect(() => {
    (async () => {
      const [{ data }, profil] = await Promise.all([supabase.auth.getSession(), lireProfil()]);
      if (data.session && estComplet(profil)) router.replace('/creer-compte');
      else setPret(true);
    })();
  }, []);

  if (!pret) return <View className="flex-1 bg-background" />;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1 justify-center px-5">
        <Text className="text-sm font-medium uppercase tracking-wide text-accent">
          Tout est en place
        </Text>
        <Text className="mt-2 text-3xl font-bold text-text-primary">
          Ton compte et ton programme sont créés.
        </Text>
        <Text className="mt-3 text-xl text-text-secondary">
          Les 12 semaines sont enregistrées. L&apos;écran « Aujourd&apos;hui » arrive avec les
          onglets.
        </Text>

        <View className="mt-8 gap-3">
          <Button
            label="Ouvrir une séance"
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: '1' } })}
          />
          <Button
            label="Se déconnecter"
            variant="secondary"
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace('/reveal');
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
