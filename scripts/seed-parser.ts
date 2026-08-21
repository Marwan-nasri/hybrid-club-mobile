/**
 * Lecture du catalogue d'exercices depuis les migrations SQL.
 *
 * ponytail: on parse le seed plutôt que de dupliquer 47 exercices dans une
 * fixture qui divergerait. La migration reste l'unique source de vérité.
 * À remplacer par un select Supabase si le catalogue devient éditable en base.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { BodyZone, Exercise, Substitution } from '../src/lib/programGenerator.ts';

/** Retire les commentaires `--`, en ignorant ceux qui sont dans une chaîne. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map((ligne) => {
      let inStr = false;
      for (let i = 0; i < ligne.length; i++) {
        if (ligne[i] === "'") {
          if (inStr && ligne[i + 1] === "'") {
            i++;
            continue;
          }
          inStr = !inStr;
        } else if (!inStr && ligne[i] === '-' && ligne[i + 1] === '-') {
          return ligne.slice(0, i);
        }
      }
      return ligne;
    })
    .join('\n');
}

/** Découpe une liste de tuples SQL en groupes, en respectant les chaînes. */
function splitTuples(texte: string): string[] {
  const groupes: string[] = [];
  let depth = 0;
  let inStr = false;
  let debut = 0;

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (inStr) {
      if (c === "'") {
        if (texte[i + 1] === "'") i++;
        else inStr = false;
      }
      continue;
    }
    if (c === "'") inStr = true;
    else if (c === '(') {
      if (depth === 0) debut = i + 1;
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth === 0) groupes.push(texte.slice(debut, i));
    }
  }
  return groupes;
}

/** Découpe un tuple en champs, en déquotant au passage. */
function splitChamps(groupe: string): string[] {
  const champs: string[] = [];
  let courant = '';
  let inStr = false;
  let depth = 0;

  for (let i = 0; i < groupe.length; i++) {
    const c = groupe[i];
    if (inStr) {
      if (c === "'") {
        if (groupe[i + 1] === "'") {
          courant += "'";
          i++;
        } else inStr = false;
      } else courant += c;
      continue;
    }
    if (c === "'") inStr = true;
    else if (c === ',' && depth === 0) {
      champs.push(courant.trim());
      courant = '';
    } else {
      if (c === '(') depth++;
      if (c === ')') depth--;
      courant += c;
    }
  }
  champs.push(courant.trim());
  return champs;
}

const parsePgArray = (v: string): string[] => {
  const inner = v.replace(/^\{|\}$/g, '').trim();
  return inner ? inner.split(',').map((s) => s.trim()) : [];
};

export type Seed = { exercises: Exercise[]; substitutions: Substitution[] };

/** Concatène toutes les migrations et en extrait le catalogue. */
export function lireSeed(racine: string): Seed {
  const dossier = join(racine, 'supabase', 'migrations');
  const sql = stripComments(
    readdirSync(dossier)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFileSync(join(dossier, f), 'utf8'))
      .join('\n'),
  );

  // Toutes les instructions, pas seulement la première : une migration
  // ultérieure peut ajouter des exercices dans un second `insert`.
  const exercises: Exercise[] = [];
  const blocs = [...sql.matchAll(/insert into exercises\s*\([^)]*\)\s*values([\s\S]*?);/gi)];
  if (blocs.length === 0) throw new Error('Seed des exercices introuvable dans supabase/migrations/.');

  for (const bloc of blocs) {
    for (const tuple of splitTuples(bloc[1])) {
      const [slug, nom, pattern, equipement, , zones] = splitChamps(tuple);
      exercises.push({
        slug,
        nom,
        pattern: pattern as Exercise['pattern'],
        equipement_requis: equipement as Exercise['equipement_requis'],
        zones_sollicitees: parsePgArray(zones) as BodyZone[],
      });
    }
  }

  const substitutions: Substitution[] = [];
  const re =
    /insert into exercise_substitutions[\s\S]*?select[^,]*,[^,]*,\s*'([a-z_]+)'\s*,\s*(\d+)[\s\S]*?in\s*\(([\s\S]*?)\)\s*;/gi;

  for (const m of sql.matchAll(re)) {
    const raison = m[1];
    const priorite = Number(m[2]);
    for (const paire of m[3].matchAll(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)) {
      substitutions.push({
        exercise_slug: paire[1],
        substitut_slug: paire[2],
        raison,
        priorite,
      });
    }
  }

  return { exercises, substitutions };
}
