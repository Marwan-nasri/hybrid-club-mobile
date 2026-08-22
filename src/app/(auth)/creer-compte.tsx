import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { enregistrerProgrammeEnAttente, ProfilIncompletError } from '@/lib/programme';
import { supabase } from '@/lib/supabase';

/**
 * Création de compte après le paywall, puis insertion du programme.
 *
 * Les trois états vivent dans cet écran plutôt que sur trois routes : le
 * chargement et l'échec doivent pouvoir revenir au formulaire ou relancer
 * l'insertion sans repasser par la navigation.
 */
type Etat = 'formulaire' | 'chargement' | 'echec';

/** Le minimum imposé par Supabase Auth (`password_min_length`, 6 par défaut). */
const LONGUEUR_MOT_DE_PASSE = 6;

/**
 * Suffisant pour écarter les fautes de frappe évidentes. La validité réelle
 * d'une adresse ne se prouve que par l'email de confirmation — inutile
 * d'empiler une regex qui rejettera des adresses légitimes.
 */
const EMAIL_PLAUSIBLE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/**
 * L'insertion prend ~800 ms. Les étapes défilent quand même : un écran qui
 * annonce ce qu'il fait se supporte mieux qu'un spinner nu, et la dernière
 * ligne reste affichée si le réseau traîne.
 */
const ETAPES = [
  'Compte créé',
  'Génération de tes 12 semaines',
  'Adaptation à tes limitations',
  'Enregistrement de ton programme',
];

function EcranChargement() {
  const [etape, setEtape] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setEtape((n) => Math.min(n + 1, ETAPES.length - 1)),
      700,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <View className="flex-1 justify-center px-5">
      <Text className="text-3xl font-bold text-text-primary">On prépare ton bloc.</Text>
      <Text className="mt-3 text-xl text-text-secondary">Quelques secondes, pas plus.</Text>

      <View className="mt-12 gap-4">
        {ETAPES.map((libelle, i) => (
          <View key={libelle} className="flex-row items-center">
            <View
              className={`mr-4 h-2 w-2 rounded-pill ${
                i <= etape ? 'bg-accent' : 'bg-border'
              }`}
            />
            <Text
              className={`text-base ${
                i <= etape ? 'text-text-primary' : 'text-text-tertiary'
              }`}>
              {libelle}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function CreerCompteScreen() {
  const [etat, setEtat] = useState<Etat>('formulaire');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  /**
   * Insère le programme et atterrit. Le compte existe déjà à ce stade : en cas
   * d'échec on ne revient jamais au formulaire, seulement à un bouton de
   * relance — le profil est toujours en attente, `enregistrerProgrammeEnAttente`
   * ne l'efface qu'après succès.
   */
  const inserer = async () => {
    setEtat('chargement');
    setErreur(null);
    try {
      await enregistrerProgrammeEnAttente();
      router.replace('/(tabs)');
    } catch (e) {
      if (e instanceof ProfilIncompletError) {
        // TODO: rediriger vers le quiz une fois qu'il existe.
        router.replace('/reveal');
        return;
      }
      setErreur(
        e instanceof Error ? e.message : "L'enregistrement de ton programme a échoué.",
      );
      setEtat('echec');
    }
  };

  // L'app relancée après une interruption pendant l'insertion : la session est
  // persistée, le compte existe déjà. On reprend à l'insertion sans jamais
  // rejouer signUp, qui échouerait en « email déjà utilisé ».
  const reprisEnCharge = useRef(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session || reprisEnCharge.current) return;
      reprisEnCharge.current = true;
      inserer();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const { data, error } = await supabase.auth.signUp({ email: adresse, password: motDePasse });
    if (error) {
      setErreur(error.message);
      setEtat('formulaire');
      return;
    }

    // Projet configuré avec « Confirm email » : signUp réussit mais ne renvoie
    // aucune session, et l'insertion échouerait sur auth.uid() null avec un
    // message Postgres illisible. On le dit clairement plutôt que de laisser
    // filer. Réglage projet à revoir — la confirmation en plein tunnel d'achat
    // est un point de friction au pire endroit.
    if (!data.session) {
      setErreur(
        'Ton compte est créé mais doit être confirmé : ouvre le lien envoyé par email, puis reviens.',
      );
      setEtat('formulaire');
      return;
    }

    reprisEnCharge.current = true;
    await inserer();
  };

  if (etat === 'chargement') {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1">
          <EcranChargement />
        </SafeAreaView>
      </View>
    );
  }

  if (etat === 'echec') {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1 justify-center px-5">
          <Text className="text-3xl font-bold text-text-primary">
            Ton compte est créé, ton programme non.
          </Text>
          <Text className="mt-3 text-xl text-text-secondary">
            Rien n&apos;est perdu — tes réponses sont conservées, il ne reste qu&apos;à
            relancer l&apos;enregistrement.
          </Text>
          {erreur ? <Text className="mt-4 text-sm text-text-tertiary">{erreur}</Text> : null}
          <View className="mt-8">
            <Button label="Réessayer" onPress={inserer} />
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
            <Text className="text-3xl font-bold text-text-primary">Crée ton compte.</Text>
            <Text className="mt-3 text-xl text-text-secondary">
              Pour retrouver ton programme sur tous tes appareils.
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
                textContentType="newPassword"
              />
            </View>

            {/* Le design system n'a pas de couleur d'erreur : `text-warning` est
                réservé aux contre-indications. Le message passe donc par une
                surface encadrée plutôt que par une couleur. */}
            {erreur ? (
              <View className="mt-4 rounded-card border border-border bg-surface p-4">
                <Text className="text-base text-text-primary">{erreur}</Text>
              </View>
            ) : null}

            <View className="mt-8">
              <Button label="Créer mon compte" onPress={soumettre} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
