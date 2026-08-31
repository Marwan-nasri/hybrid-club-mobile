import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appleDisponible, connexionAvecApple } from '@/lib/auth';
import { lierCompte } from '@/lib/purchases';
import { programmeActif } from '@/lib/seances';
import { supabase } from '@/lib/supabase';

/**
 * Retour dans un compte existant.
 *
 * Pendant du tunnel d'inscription, pas sa copie : ici le programme existe
 * déjà, on ne l'insère pas. Les états et les composants sont ceux de
 * `creer-compte.tsx` — même formulaire, même façon d'afficher une erreur.
 */
type Etat = 'formulaire' | 'chargement' | 'sans_programme';

/** Même seuil que la création de compte : `password_min_length` côté Supabase. */
const LONGUEUR_MOT_DE_PASSE = 6;

const EMAIL_PLAUSIBLE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export default function ConnexionScreen() {
  const [etat, setEtat] = useState<Etat>('formulaire');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    appleDisponible().then(setApple).catch(() => setApple(false));
  }, []);

  /**
   * Ce qui suit une session ouverte, quel que soit le moyen.
   *
   * Le rattachement RevenueCat vaut aussi à la connexion : un utilisateur qui
   * réinstalle l'app arrive avec une identité anonyme, et sans `logIn` son
   * abonnement resterait collé à l'appareil précédent. L'échec est avalé —
   * comme à l'inscription, il n'y a rien d'utile à en dire ici et ça ne doit
   * pas barrer l'entrée.
   */
  const atterrir = async (idUtilisateur: string) => {
    await lierCompte(idUtilisateur).catch(() => {});

    // Ne devrait jamais être vide : `creer_programme` écrit profil et programme
    // dans la même transaction. Mais un compte à moitié créé vaut mieux dit
    // qu'affiché sous forme d'onglets vides.
    if (!(await programmeActif())) {
      setEtat('sans_programme');
      return;
    }
    router.replace('/(tabs)');
  };

  const soumettre = async () => {
    const adresse = email.trim();

    if (!EMAIL_PLAUSIBLE.test(adresse)) {
      setErreur('Cette adresse email ne semble pas valide.');
      return;
    }
    if (motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
      setErreur(`Ton mot de passe doit faire au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`);
      return;
    }

    setEtat('chargement');
    setErreur(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: adresse,
      password: motDePasse,
    });

    if (error || !data.user) {
      // Supabase répond « Invalid login credentials » sans distinguer l'adresse
      // inconnue du mot de passe faux — c'est volontaire de leur part, on ne
      // cherche pas à en dire plus.
      setErreur(error?.message ?? 'Connexion impossible.');
      setEtat('formulaire');
      return;
    }

    try {
      await atterrir(data.user.id);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible de charger ton programme.');
      setEtat('formulaire');
    }
  };

  const parApple = async () => {
    setEtat('chargement');
    setErreur(null);
    try {
      const resultat = await connexionAvecApple();
      if (resultat.statut === 'annule') {
        setEtat('formulaire');
        return;
      }
      // Rien à insérer même si Apple vient de créer le compte : sans profil
      // d'onboarding en attente, il n'y a pas de programme à générer. C'est
      // `sans_programme` qui le dira.
      await atterrir(resultat.idUtilisateur);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'La connexion avec Apple a échoué.');
      setEtat('formulaire');
    }
  };

  if (etat === 'chargement') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (etat === 'sans_programme') {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1 justify-center px-5">
          <Text className="text-3xl font-bold text-text-primary">
            Ce compte n&apos;a pas de programme.
          </Text>
          <Text className="mt-3 text-xl text-text-secondary">
            Tu es bien connecté, mais aucun bloc n&apos;est rattaché à ce compte. Refais le
            questionnaire pour en générer un.
          </Text>
          <View className="mt-8 gap-3">
            <Button label="Refaire le questionnaire" onPress={() => router.replace('/accroche')} />
            <Button
              label="Réessayer"
              variant="secondary"
              onPress={() =>
                supabase.auth
                  .getUser()
                  .then(({ data }) => data.user && atterrir(data.user.id))
                  .catch(() => {})
              }
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView className="px-5" contentContainerClassName="grow justify-center pb-8">
            <Text className="text-3xl font-bold text-text-primary">Content de te revoir.</Text>
            <Text className="mt-3 text-xl text-text-secondary">
              Reprends ton bloc là où tu l&apos;as laissé.
            </Text>

            <View className="mt-8 gap-4">
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="toi@exemple.com"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
              />
              <Input
                label="Mot de passe"
                value={motDePasse}
                onChangeText={setMotDePasse}
                placeholder={`${LONGUEUR_MOT_DE_PASSE} caractères minimum`}
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
              />
            </View>

            {/* Même parti pris que la création de compte : pas de couleur
                d'erreur dans le design system, le message passe par une
                surface encadrée. */}
            {erreur ? (
              <View className="mt-4 rounded-card border border-border bg-surface p-4">
                <Text className="text-base text-text-primary">{erreur}</Text>
              </View>
            ) : null}

            <View className="mt-8">
              <Button label="Se connecter" onPress={soumettre} />
            </View>

            {apple ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                style={{ height: 56, marginTop: 12 }}
                onPress={parApple}
              />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
