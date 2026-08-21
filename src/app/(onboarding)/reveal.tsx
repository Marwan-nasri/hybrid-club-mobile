import { router } from 'expo-router';

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatBlock } from '@/components/ui/StatBlock';
import { NOM_EXERCICE } from '@/lib/catalogue';
import { genererProgramme } from '@/lib/programme';

import type { BodyZone, GeneratedSession, GeneratorProfile } from '@/lib/programGenerator';

// TODO: à remplacer par l'état du quiz d'onboarding quand les 10 écrans existeront.
// En attendant, le profil de la maquette A6 : Hyrox, 5 jours, épaule sensible.
const PROFIL_DEMO: GeneratorProfile = {
  objectif: 'hyrox',
  niveau: 'intermediaire',
  jours_dispo: 5,
  equipement: 'salle_complete',
  limitations: ['epaule'],
  squat_1rm: 140,
  bench_1rm: 100,
  deadlift_1rm: 180,
};

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const ZONES: Record<BodyZone, string> = {
  epaule: 'ton épaule',
  coude: 'ton coude',
  poignet: 'ton poignet',
  dos_bas: 'ton bas du dos',
  hanche: 'ta hanche',
  genou: 'ton genou',
  cheville: 'ta cheville',
};

/** Résumé d'une séance : « Squat barre 4×6 · Soulevé de terre roumain 3×8 ». */
function resumeSeance(session: GeneratedSession): string {
  return session.blocks
    .map((b) => {
      if (b.exercise_slug) {
        const nom = NOM_EXERCICE.get(b.exercise_slug) ?? b.exercise_slug;
        return b.series && b.reps_cible ? `${nom} ${b.series}×${b.reps_cible}` : nom;
      }
      if (b.intervalles) {
        const i = b.intervalles;
        return `${i.repetitions}×${i.effort_sec} s · r ${i.recup_sec} s`;
      }
      if (b.duree_sec) return `${Math.round(b.duree_sec / 60)} min`;
      return null;
    })
    .filter(Boolean)
    .join(' · ');
}

/**
 * Les mouvements que le catalogue n'a pas su substituer restent au programme :
 * ils doivent au minimum être signalés, jamais passer en silence.
 */
function alerte(session: GeneratedSession) {
  const zones = [...new Set(session.blocks.map((b) => b.contre_indication).filter(Boolean))];
  if (zones.length === 0) return null;

  const n = session.blocks.filter((b) => b.contre_indication).length;
  const libelle = zones.map((z) => ZONES[z as BodyZone]).join(' et ');
  return (
    <Text className="mt-1 text-xs text-warning">
      {n === 1 ? '1 mouvement sollicite' : `${n} mouvements sollicitent`} {libelle} — à adapter.
    </Text>
  );
}

function formatVolume(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

/** Le lundi de la semaine en cours, puis le dimanche : « 4 sept. — 10 sept. ». */
function libelleSemaine(): string {
  const jour = new Date();
  const lundi = new Date(jour);
  lundi.setDate(jour.getDate() - ((jour.getDay() + 6) % 7));
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);

  const format = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${format(lundi)} — ${format(dimanche)}`;
}

function description(profile: GeneratorProfile): string {
  const base = profile.squat_1rm
    ? 'Construit sur les charges que tu as déclarées'
    : 'Construit sur ton niveau déclaré';
  const zones = profile.limitations.map((z) => ZONES[z]).join(' et ');
  return zones ? `${base} et adapté à ${zones}.` : `${base}.`;
}

export default function RevealScreen() {
  const programme = genererProgramme(PROFIL_DEMO);

  if (__DEV__ && programme.warnings.length > 0) {
    console.warn(
      `[programGenerator] ${programme.warnings.length} avertissement(s) :\n` +
        programme.warnings.map((w) => `  [${w.code}] ${w.message}`).join('\n'),
    );
  }

  const semaine1 = programme.sessions.filter((s) => s.semaine === 1);
  const volume = formatVolume(semaine1.reduce((total, s) => total + s.duree_estimee_min, 0));

  // Les jours sans séance sont du repos : la semaine s'affiche en entier.
  const semaine = JOURS.map((label, i) => ({
    label,
    session: semaine1.find((s) => s.jour === i + 1) ?? null,
  }));

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView className="px-5" contentContainerClassName="pb-32">
          <Text className="mt-4 text-sm font-medium uppercase tracking-wide text-accent">
            Ton plan est prêt
          </Text>
          <Text className="mt-2 text-3xl font-bold text-text-primary">{programme.program.nom}</Text>
          <Text className="mt-3 text-xl text-text-secondary">{description(PROFIL_DEMO)}</Text>

          <View className="mt-6 flex-row gap-3">
            <View className="flex-1">
              <StatBlock label="Durée" value={`${programme.program.duree_semaines} sem.`} />
            </View>
            <View className="flex-1">
              <StatBlock label="Fréquence" value={`${programme.program.jours_par_semaine} / sem.`} />
            </View>
            <View className="flex-1">
              <StatBlock label="Volume" value={volume} />
            </View>
          </View>

          <Text className="mt-8 text-sm font-medium uppercase tracking-wide text-text-tertiary">
            Structure du bloc
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {Array.from({ length: programme.program.duree_semaines }, (_, i) => i + 1).map((n) => {
              const active = n === 1;
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
            {programme.phases.map((p) => (
              <Text key={`${p.label}-${p.de}`} className="text-xs text-text-tertiary">
                {p.de === p.a ? `S${p.de}` : `S${p.de}–${p.a}`} · {p.label}
              </Text>
            ))}
          </View>

          <View className="mt-8 flex-row items-baseline justify-between">
            <Text className="text-sm font-medium uppercase tracking-wide text-text-tertiary">
              Semaine 1 en détail
            </Text>
            <Text className="text-sm text-text-tertiary">{libelleSemaine()}</Text>
          </View>

          <View className="mt-3 gap-3">
            {semaine.map(({ label, session }) => (
              <Card key={label}>
                <View className="flex-row items-center">
                  <Text
                    className={`w-12 text-sm font-medium uppercase tracking-wide ${
                      session ? 'text-accent' : 'text-text-tertiary'
                    }`}>
                    {label}
                  </Text>
                  <View className="flex-1 pr-3">
                    <Text className="text-xl font-semibold text-text-primary">
                      {session ? session.nom : 'Repos'}
                    </Text>
                    {session ? (
                      <Text className="mt-1 text-base text-text-secondary">
                        {resumeSeance(session)}
                      </Text>
                    ) : null}
                    {session ? alerte(session) : null}
                  </View>
                  <Text className="text-base text-text-secondary">
                    {session ? `${session.duree_estimee_min} min` : '—'}
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
