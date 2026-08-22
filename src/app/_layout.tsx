import '@/global.css';

import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    supabase.from('exercises').select('nom').limit(3)
      .then(({ data, error }) => {
        if (error) console.error('Erreur Supabase:', error);
        else console.log('Connexion OK:', data);
      });
  }, []);

  // Dark-only : pas de useColorScheme, le CLAUDE.md exclut le light mode.
  return (
    <ThemeProvider value={DarkTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="(onboarding)/reveal" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(auth)/creer-compte" options={{ gestureEnabled: false }} />
      </Stack>
    </ThemeProvider>
  );
}
