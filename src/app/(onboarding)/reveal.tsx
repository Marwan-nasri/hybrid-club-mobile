import { router } from 'expo-router';

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatBlock } from '@/components/ui/StatBlock';

// Structure calquée sur le schéma Supabase (programs / sessions / session_blocks)
// pour que le branchement du moteur de génération ne demande pas de réécriture.
type SessionBlock = { exercice: string; prescription: string };

type Session = {
  jour: string;
  nom: string;
  duree_min: number;
  repos: boolean;
  blocks: SessionBlock[];
};

type Phase = { label: string; de: number; a: number };

type Program = {
  nom: string;
  objectif: string;
  niveau: string;
  duree_semaines: number;
  description: string;
  phases: Phase[];
  semaine_courante: number;
  semaine_libelle: string;
  sessions: Session[];
};

const PROGRAMME: Program = {
  nom: 'Bloc Hyrox — Base 1',
  objectif: 'hyrox',
  niveau: 'intermediaire',
  duree_semaines: 12,
  description: 'Construit sur tes benchmarks du 18 août et adapté à ton épaule droite.',
  phases: [
    { label: 'Base', de: 1, a: 4 },
    { label: 'Intensification', de: 5, a: 8 },
    { label: 'Spécifique', de: 9, a: 12 },
  ],
  semaine_courante: 1,
  semaine_libelle: '4 sept. — 10 sept.',
  sessions: [
    {
      jour: 'Lun',
      nom: 'Force — Bas du corps',
      duree_min: 62,
      repos: false,
      blocks: [
        { exercice: 'Back squat', prescription: '4×5' },
        { exercice: 'RDL', prescription: '3×8' },
        { exercice: 'Fentes lestées', prescription: '3×10' },
      ],
    },
    {
      jour: 'Mar',
      nom: 'Endurance — Seuil',
      duree_min: 48,
      repos: false,
      blocks: [{ exercice: '6×800 m', prescription: "@ 4'12/km · r 90 s" }],
    },
    {
      jour: 'Mer',
      nom: 'Repos actif',
      duree_min: 55,
      repos: true,
      blocks: [
        { exercice: 'Mobilité hanches', prescription: '15 min' },
        { exercice: 'Marche', prescription: '40 min' },
      ],
    },
    {
      jour: 'Jeu',
      nom: 'Force — Haut du corps',
      duree_min: 58,
      repos: false,
      blocks: [
        { exercice: 'Développé couché', prescription: '4×6' },
        { exercice: 'Tractions lestées', prescription: '4×6' },
        { exercice: 'Rowing barre', prescription: '4×8' },
      ],
    },
    {
      jour: 'Ven',
      nom: 'Hyrox — Compromis',
      duree_min: 62,
      repos: false,
      blocks: [
        { exercice: '4 tours', prescription: '400 m · 20 wall balls · 15 burpees' },
      ],
    },
    {
      jour: 'Sam',
      nom: 'Endurance — Sortie longue',
      duree_min: 90,
      repos: false,
      blocks: [{ exercice: '14 km', prescription: "@ 5'10/km" }],
    },
    {
      jour: 'Dim',
      nom: 'Repos',
      duree_min: 0,
      repos: true,
      blocks: [],
    },
  ],
};

function resumeBlocks(blocks: SessionBlock[]) {
  return blocks.map((b) => `${b.exercice} ${b.prescription}`.trim()).join(' · ');
}

function formatVolume(minutes: number) {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

export default function RevealScreen() {
  // Dérivé des séances : fréquence et volume ne peuvent pas diverger de la liste.
  const seances = PROGRAMME.sessions.filter((s) => !s.repos);
  const volume = formatVolume(seances.reduce((total, s) => total + s.duree_min, 0));

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView className="px-5" contentContainerClassName="pb-32">
          <Text className="mt-4 text-sm font-medium uppercase tracking-wide text-accent">
            Ton plan est prêt
          </Text>
          <Text className="mt-2 text-3xl font-bold text-text-primary">{PROGRAMME.nom}</Text>
          <Text className="mt-3 text-xl text-text-secondary">{PROGRAMME.description}</Text>

          <View className="mt-6 flex-row gap-3">
            <View className="flex-1">
              <StatBlock label="Durée" value={`${PROGRAMME.duree_semaines} sem.`} />
            </View>
            <View className="flex-1">
              <StatBlock label="Fréquence" value={`${seances.length} / sem.`} />
            </View>
            <View className="flex-1">
              <StatBlock label="Volume" value={volume} />
            </View>
          </View>

          <Text className="mt-8 text-sm font-medium uppercase tracking-wide text-text-tertiary">
            Structure du bloc
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {Array.from({ length: PROGRAMME.duree_semaines }, (_, i) => i + 1).map((n) => {
              // Affichage seul : seule la semaine 1 a des séances tant que le
              // moteur de génération n'est pas branché.
              const active = n === PROGRAMME.semaine_courante;
              return (
                <Card
                  key={n}
                  className={`w-[15%] grow items-center px-1 py-4 ${active ? '!border-accent' : ''}`}>
                  <Text
                    className={`text-base font-semibold ${
                      active ? 'text-accent' : 'text-text-secondary'
                    }`}>
                    S{n}
                  </Text>
                  {active ? <View className="mt-1 h-0.5 w-4 rounded-pill bg-accent" /> : null}
                </Card>
              );
            })}
          </View>
          <View className="mt-3 flex-row flex-wrap gap-x-6 gap-y-1">
            {PROGRAMME.phases.map((p) => (
              <Text key={p.label} className="text-xs text-text-tertiary">
                S{p.de}–{p.a} · {p.label}
              </Text>
            ))}
          </View>

          <View className="mt-8 flex-row items-baseline justify-between">
            <Text className="text-sm font-medium uppercase tracking-wide text-text-tertiary">
              Semaine {PROGRAMME.semaine_courante} en détail
            </Text>
            <Text className="text-sm text-text-tertiary">{PROGRAMME.semaine_libelle}</Text>
          </View>

          <View className="mt-3 gap-3">
            {PROGRAMME.sessions.map((s) => (
              <Card key={s.jour}>
                <View className="flex-row items-center">
                  <Text
                    className={`w-12 text-sm font-medium uppercase tracking-wide ${
                      s.repos ? 'text-text-tertiary' : 'text-accent'
                    }`}>
                    {s.jour}
                  </Text>
                  <View className="flex-1 pr-3">
                    <Text className="text-xl font-semibold text-text-primary">{s.nom}</Text>
                    {s.blocks.length > 0 ? (
                      <Text className="mt-1 text-base text-text-secondary">
                        {resumeBlocks(s.blocks)}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-base text-text-secondary">
                    {s.duree_min > 0 ? `${s.duree_min} min` : '—'}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      <View className="absolute inset-x-0 bottom-0 bg-background px-5 pt-3">
        <SafeAreaView edges={['bottom']}>
          <Button label="Voir mon accès" onPress={() => router.push('/paywall')} />
        </SafeAreaView>
      </View>
    </View>
  );
}
