/**
 * Vérification de bout en bout de l'insertion Supabase.
 *
 *   TEST_EMAIL=... TEST_PASSWORD=... npm run test:insertion
 *
 * Génère le programme de PROFIL_DEMO, l'insère via creer_programme (migration
 * 006), puis relit les 3 tables et affiche ce qui a réellement été écrit.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { generateProgram } from '../src/lib/programGenerator.ts';
import { lireSeed } from './seed-parser.ts';

import type { GeneratorProfile, LevelTemplate, LevelType } from '../src/lib/programGenerator.ts';

const RACINE = join(import.meta.dirname, '..');
process.loadEnvFile(join(RACINE, '.env'));

const { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD } =
  process.env;

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error('TEST_EMAIL et TEST_PASSWORD sont requis (utilisateur de test Supabase).');
  process.exit(1);
}

// Le profil de reveal.tsx, à l'identique.
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

const templates = Object.fromEntries(
  (['debutant', 'intermediaire', 'avance'] as LevelType[]).map((n) => [
    n,
    JSON.parse(
      readFileSync(join(RACINE, 'moteur-reference', `template-niveau-${n}.json`), 'utf8'),
    ) as LevelTemplate,
  ]),
) as Record<LevelType, LevelTemplate>;

const { exercises, substitutions } = lireSeed(RACINE);
const programme = generateProgram({ profile: PROFIL_DEMO, templates, exercises, substitutions });

const blocsGeneres = programme.sessions.reduce((n, s) => n + s.blocks.length, 0);
console.log(
  `Généré : ${programme.sessions.length} séances, ${blocsGeneres} blocs, ` +
    `${programme.warnings.length} avertissement(s).`,
);

const supabase = createClient(EXPO_PUBLIC_SUPABASE_URL!, EXPO_PUBLIC_SUPABASE_ANON_KEY!);

const { error: errAuth } = await supabase.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
});
if (errAuth) {
  console.error(`Connexion impossible : ${errAuth.message}`);
  process.exit(1);
}

const debut = Date.now();
const { data: programId, error } = await supabase.rpc('creer_programme', {
  programme: { ...programme.program, sessions: programme.sessions },
});
if (error) {
  console.error(`Insertion échouée [${error.code ?? 'réseau'}] : ${error.message}`);
  process.exit(1);
}
console.log(`Inséré en ${Date.now() - debut} ms — program_id ${programId}`);

// ── Relecture ────────────────────────────────────────────────────────────────

const { data: prog } = await supabase.from('programs').select('*').eq('id', programId).single();
const { data: seances } = await supabase
  .from('sessions')
  .select('id, semaine, jour, type, nom, duree_estimee_min, note_coaching')
  .eq('program_id', programId)
  .order('semaine')
  .order('jour');

const ids = (seances ?? []).map((s) => s.id);
const { data: blocs } = await supabase
  .from('session_blocks')
  .select('session_id, ordre, exercise_id, series, reps_cible, pct_1rm, rpe, repos_sec, cardio_type, duree_sec, distance_m, intervalles, notes, exercises(slug)')
  .in('session_id', ids)
  .order('ordre');

console.log(
  `\nRelu : programs 1 (${prog?.nom}, actif=${prog?.is_active}), ` +
    `sessions ${seances?.length}, session_blocks ${blocs?.length}.`,
);

const orphelins = (blocs ?? []).filter((b) => b.exercise_id === null && b.cardio_type === null);
console.log(`Blocs sans exercice ni cardio : ${orphelins.length} (attendu 0).`);

const s1 = (seances ?? []).filter((s) => s.semaine === 1);
console.log(`\nSemaine 1 relue depuis la base :`);
for (const s of s1) {
  const siens = (blocs ?? []).filter((b) => b.session_id === s.id);
  console.log(`  J${s.jour} · ${s.nom} (${s.type}, ${s.duree_estimee_min} min)`);
  for (const b of siens) {
    const lie = b.exercises as unknown as { slug: string } | null;
    const nom = lie?.slug ?? b.cardio_type ?? '—';
    const dose = [
      b.series && b.reps_cible ? `${b.series}×${b.reps_cible}` : b.reps_cible,
      b.pct_1rm ? `${b.pct_1rm}%` : null,
      b.rpe ? `RPE ${b.rpe}` : null,
      b.duree_sec ? `${Math.round(b.duree_sec / 60)} min` : null,
      b.intervalles ? JSON.stringify(b.intervalles) : null,
    ]
      .filter(Boolean)
      .join('  ');
    console.log(`     ${b.ordre}. ${nom}  ${dose}`);
  }
  if (s.note_coaching) console.log(`     note : ${s.note_coaching}`);
}

// Contrôles : rien ne doit avoir été perdu entre la mémoire et la base.
const attendu = programme.sessions.length;
if (seances?.length !== attendu) throw new Error(`${seances?.length} séances relues, ${attendu} attendues`);
if (blocs?.length !== blocsGeneres) throw new Error(`${blocs?.length} blocs relus, ${blocsGeneres} attendus`);
console.log('\nTous les comptes correspondent. Programme visible dans Supabase.\n');
