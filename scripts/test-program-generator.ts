/**
 * Vérification à l'œil du moteur de génération.
 *
 *   node --experimental-strip-types scripts/test-program-generator.ts
 *
 * Pas de framework : on affiche 3 programmes en console et on lit le résultat.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateProgram } from '../src/lib/programGenerator.ts';
import type {
  GeneratedProgram,
  GeneratorProfile,
  LevelTemplate,
  LevelType,
} from '../src/lib/programGenerator.ts';
import { lireSeed } from './seed-parser.ts';

const RACINE = join(import.meta.dirname, '..');

function lireTemplates(): Record<LevelType, LevelTemplate> {
  const lire = (niveau: string): LevelTemplate =>
    JSON.parse(
      readFileSync(join(RACINE, 'moteur-reference', `template-niveau-${niveau}.json`), 'utf8'),
    ) as LevelTemplate;

  return {
    debutant: lire('debutant'),
    intermediaire: lire('intermediaire'),
    avance: lire('avance'),
  };
}

// ── Affichage ────────────────────────────────────────────────────────────────

const SEMAINES_AFFICHEES = [1, 4, 12];

function decrireBloc(b: GeneratedProgram['sessions'][number]['blocks'][number]): string {
  const morceaux: string[] = [];

  if (b.exercise_slug) morceaux.push(b.exercise_slug);
  else if (b.cardio_type) morceaux.push(b.cardio_type);

  if (b.series !== null && b.reps_cible !== null) morceaux.push(`${b.series}×${b.reps_cible}`);
  else if (b.reps_cible !== null) morceaux.push(b.reps_cible);

  if (b.intervalles) {
    const i = b.intervalles;
    morceaux.push(`${i.repetitions}×${i.effort_sec}s / r${i.recup_sec}s`);
  } else if (b.duree_sec !== null) {
    morceaux.push(`${Math.round(b.duree_sec / 60)} min`);
  }

  if (b.pct_1rm !== null) morceaux.push(`${b.pct_1rm}%`);
  if (b.charge_kg !== null) morceaux.push(`${b.charge_kg} kg`);
  if (b.rpe !== null) morceaux.push(`RPE ${b.rpe}`);

  return morceaux.join('  ');
}

function afficher(titre: string, profile: GeneratorProfile, resultat: GeneratedProgram): void {
  console.log('\n' + '='.repeat(78));
  console.log(titre);
  console.log('='.repeat(78));
  console.log(
    `${resultat.program.nom} · ${profile.niveau} · ${resultat.program.jours_par_semaine} j/sem · ` +
      `${profile.equipement} · limitations: ${profile.limitations.join(', ') || 'aucune'}`,
  );
  console.log(
    `ratio muscu/cardio ${resultat.ratio_muscu_cardio} · ${resultat.sessions.length} séances générées`,
  );

  for (const semaine of SEMAINES_AFFICHEES) {
    const duSemaine = resultat.sessions.filter((s) => s.semaine === semaine);
    const volume = duSemaine.reduce(
      (n, s) => n + s.blocks.reduce((m, b) => m + (b.series ?? 0), 0),
      0,
    );
    console.log(`\n─ Semaine ${semaine} ─ ${volume} séries au total`);

    for (const s of duSemaine) {
      console.log(`\n  J${s.jour} · ${s.nom} (${s.type}, ${s.duree_estimee_min} min)`);
      if (s.note_coaching) console.log(`     « ${s.note_coaching} »`);
      for (const b of s.blocks) {
        console.log(`     ${String(b.ordre).padStart(2)}. ${decrireBloc(b)}`);
        if (b.notes) console.log(`         ${b.notes}`);
      }
    }
  }

  console.log(`\n─ Avertissements (${resultat.warnings.length}) ─`);
  if (resultat.warnings.length === 0) {
    console.log('  aucun');
  } else {
    const parCode = new Map<string, string[]>();
    for (const w of resultat.warnings) {
      const liste = parCode.get(w.code) ?? [];
      liste.push(w.message);
      parCode.set(w.code, liste);
    }
    for (const [code, messages] of parCode) {
      console.log(`\n  [${code}] ×${messages.length}`);
      for (const m of messages) console.log(`    · ${m}`);
    }
  }
}

// ── Contrôles automatiques ───────────────────────────────────────────────────

function verifier(nom: string, resultat: GeneratedProgram, profile: GeneratorProfile): void {
  const attendu = 12 * profile.jours_dispo;
  if (resultat.sessions.length !== attendu) {
    throw new Error(`${nom} : ${resultat.sessions.length} séances au lieu de ${attendu}.`);
  }

  // Contrainte unique (program_id, semaine, jour) de la table sessions.
  const cles = new Set(resultat.sessions.map((s) => `${s.semaine}-${s.jour}`));
  if (cles.size !== resultat.sessions.length) {
    throw new Error(`${nom} : doublons sur (semaine, jour) — violerait l'unicité de sessions.`);
  }

  for (const s of resultat.sessions) {
    for (const b of s.blocks) {
      if (b.rpe !== null && (b.rpe < 1 || b.rpe > 10)) {
        throw new Error(`${nom} : RPE ${b.rpe} hors bornes (contrainte SQL 1-10).`);
      }
      if (b.charge_kg !== null && Math.round(b.charge_kg * 10) % 25 !== 0) {
        throw new Error(`${nom} : charge ${b.charge_kg} kg non arrondie au 2,5 kg.`);
      }
      if (b.charge_kg !== null && b.pct_1rm === null) {
        throw new Error(`${nom} : charge sans %1RM sur ${b.exercise_slug}.`);
      }
    }
  }
}

// ── Profils de test ──────────────────────────────────────────────────────────

const PROFILS: { titre: string; profile: GeneratorProfile }[] = [
  {
    titre: 'PROFIL 1 — intermédiaire / hyrox / 4 jours / salle complète / sans limitation',
    profile: {
      objectif: 'hyrox',
      niveau: 'intermediaire',
      jours_dispo: 4,
      equipement: 'salle_complete',
      limitations: [],
      squat_1rm: 140,
      bench_1rm: 100,
      deadlift_1rm: 180,
    },
  },
  {
    titre: 'PROFIL 2 — débutant / recomposition / 2 jours / haltères seuls / épaule',
    profile: {
      objectif: 'recomposition',
      niveau: 'debutant',
      jours_dispo: 2,
      equipement: 'halteres_seuls',
      limitations: ['epaule'],
      squat_1rm: null,
      bench_1rm: null,
      deadlift_1rm: null,
    },
  },
  {
    titre: 'PROFIL 3 — avancé / performance / 5 jours / home gym / genou + dos bas',
    profile: {
      objectif: 'performance',
      niveau: 'avance',
      jours_dispo: 5,
      equipement: 'home_gym',
      limitations: ['genou', 'dos_bas'],
      squat_1rm: 175,
      bench_1rm: 125,
      deadlift_1rm: 220,
    },
  },
];

const { exercises, substitutions } = lireSeed(RACINE);
const templates = lireTemplates();

console.log(
  `Seed lu : ${exercises.length} exercices, ${substitutions.length} substitutions ` +
    `(${new Set(substitutions.map((s) => s.raison)).size} raisons distinctes).`,
);

for (const { titre, profile } of PROFILS) {
  const resultat = generateProgram({ profile, templates, exercises, substitutions });
  afficher(titre, profile, resultat);
  verifier(titre, resultat, profile);
}

console.log('\nTous les contrôles automatiques passent.\n');
