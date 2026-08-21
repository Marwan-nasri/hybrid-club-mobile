/**
 * Moteur de génération de programme — 12 semaines, déterministe, sans IA.
 *
 * Fonction pure : aucune lecture réseau ni fichier. Le profil, les templates,
 * le catalogue d'exercices et les substitutions sont fournis déjà chargés.
 * L'insertion dans programs / sessions / session_blocks se fait séparément.
 */

// ── Enums du schéma (miroir de 001_init_schema.sql) ──────────────────────────

export type GoalType = 'hyrox' | 'marathon_muscu' | 'recomposition' | 'performance';
export type LevelType = 'debutant' | 'intermediaire' | 'avance';
export type SessionType = 'muscu' | 'cardio' | 'hybride' | 'repos';
export type MovementPattern =
  | 'squat' | 'hinge' | 'push_horizontal' | 'push_vertical'
  | 'pull_horizontal' | 'pull_vertical' | 'lunge' | 'carry' | 'core' | 'isolation';
export type CardioType = 'course' | 'rameur' | 'assault_bike' | 'ski_erg' | 'velo' | 'marche_inclinee';
export type BodyZone = 'epaule' | 'coude' | 'poignet' | 'dos_bas' | 'hanche' | 'genou' | 'cheville';
export type EquipmentType = 'salle_complete' | 'home_gym' | 'halteres_seuls' | 'poids_corps';

// ── Entrées ──────────────────────────────────────────────────────────────────

/** Sous-ensemble de `profiles` dont le moteur a besoin. */
export type GeneratorProfile = {
  objectif: GoalType;
  niveau: LevelType;
  jours_dispo: number;
  equipement: EquipmentType;
  limitations: BodyZone[];
  squat_1rm: number | null;
  bench_1rm: number | null;
  deadlift_1rm: number | null;
};

/** Ligne de `exercises`, réduite à ce qui sert ici. */
export type Exercise = {
  slug: string;
  nom: string;
  pattern: MovementPattern;
  equipement_requis: EquipmentType;
  zones_sollicitees: BodyZone[];
};

/**
 * Ligne de `exercise_substitutions`, exprimée en slugs plutôt qu'en uuid :
 * la jointure exercise_id → slug est faite par la couche de chargement.
 */
export type Substitution = {
  exercise_slug: string;
  substitut_slug: string;
  raison: string;
  priorite: number;
};

export type Intervalles = { effort_sec: number; recup_sec: number; repetitions: number };

export type TemplateBlock = {
  exercise_slug?: string;
  ordre: number;
  series?: number;
  reps_cible?: string;
  pct_1rm?: number;
  rpe?: number;
  repos_sec?: number;
  cardio_type?: CardioType;
  duree_sec?: number;
  distance_m?: number;
  intervalles?: Intervalles;
  notes?: string;
};

export type TemplateDay = {
  id: string;
  nom: string;
  type: SessionType;
  duree_estimee_min: number;
  note?: string;
  blocs_semaine_1: TemplateBlock[];
};

export type ObjectifModifier = {
  ordre: string[];
  ratio_muscu_cardio: number;
  note_coaching: string;
};

/** Progression par intensité — niveaux intermédiaire et avancé. */
export type IntensityPhase = {
  semaines: number[];
  pct_1rm: number[];
  rpe: number[];
  volume_modifier: number;
};

/** Progression par incréments additifs — niveau débutant, aucun %1RM. */
export type IncrementPhase = {
  semaines: number[];
  increment_reps: number[];
  increment_duree_sec: number[];
  increment_distance_m: number[];
  increment_cardio_min: number[];
  note?: string;
};

export type ProgressionPhase = IntensityPhase | IncrementPhase;

export type LevelTemplate = {
  template_id: string;
  niveau: LevelType;
  pool_jours: TemplateDay[];
  objectif_modifiers: Record<string, ObjectifModifier>;
  /** Contient les phases, plus éventuellement des clés de documentation (ex. `regle`). */
  progression: Record<string, unknown>;
  /** Débutant uniquement : phases pédagogiques, sources des notes de coaching. */
  phases?: Record<string, { semaines: number[]; objectif: string; regle_progression?: string }>;
};

export type GeneratorInput = {
  profile: GeneratorProfile;
  templates: Record<LevelType, LevelTemplate>;
  exercises: Exercise[];
  substitutions: Substitution[];
};

// ── Sorties ──────────────────────────────────────────────────────────────────

export type GeneratedBlock = {
  ordre: number;
  exercise_slug: string | null;
  series: number | null;
  reps_cible: string | null;
  pct_1rm: number | null;
  rpe: number | null;
  repos_sec: number | null;
  cardio_type: CardioType | null;
  duree_sec: number | null;
  distance_m: number | null;
  intervalles: Intervalles | null;
  notes: string | null;
  /** Dérivé du 1RM courant — NON persisté, `session_blocks` ne stocke que pct_1rm. */
  charge_kg: number | null;
  /** Zone limitée que ce mouvement sollicite malgré tout — dérivé, non persisté. */
  contre_indication: BodyZone | null;
};

export type GeneratedSession = {
  semaine: number;
  jour: number;
  type: SessionType;
  nom: string;
  duree_estimee_min: number;
  /** `sessions` n'a pas de colonne pour ça — en mémoire, pour le reveal A6. */
  note_coaching: string | null;
  blocks: GeneratedBlock[];
};

export type WarningCode =
  | 'exercice_introuvable'
  | 'substitut_introuvable'
  | 'substitut_equipement_introuvable'
  | 'substitut_toujours_contre_indique'
  | 'doublon_dans_seance'
  | '1rm_manquant';

export type GenerationWarning = {
  code: WarningCode;
  exercise_slug: string;
  raison: string | null;
  message: string;
};

/** Une phase de la périodisation, pour l'affichage de la structure du bloc. */
export type ProgramPhase = { label: string; de: number; a: number };

export type GeneratedProgram = {
  program: {
    nom: string;
    objectif: GoalType;
    niveau: LevelType;
    duree_semaines: 12;
    jours_par_semaine: number;
  };
  sessions: GeneratedSession[];
  /** Les phases réelles lues dans `progression`, deloads compris. */
  phases: ProgramPhase[];
  warnings: GenerationWarning[];
  /** Lu dans objectif_modifiers — à réécrire sur profiles.ratio_muscu_cardio. */
  ratio_muscu_cardio: number;
};

// ── Constantes de calibration ────────────────────────────────────────────────

export const DUREE_SEMAINES = 12;

/**
 * Quel 1RM déclaré sert de référence, et avec quel coefficient.
 * Seuls ces slugs portent un pct_1rm dans les templates.
 * Coefficients à ajuster : ce sont des ratios de coaching, pas des constantes physiques.
 */
const REF_1RM: Record<string, { ref: 'squat' | 'bench' | 'deadlift'; coef: number }> = {
  'back-squat': { ref: 'squat', coef: 1.0 },
  'front-squat': { ref: 'squat', coef: 0.85 },   // un front squat ne se charge pas comme un back squat
  'deadlift': { ref: 'deadlift', coef: 1.0 },
  'bench-press': { ref: 'bench', coef: 1.0 },
  'overhead-press': { ref: 'bench', coef: 0.65 }, // pas de 1RM vertical déclaré à l'onboarding
};

/** Arrondi des charges, en kg. */
const PAS_CHARGE_KG = 2.5;

const PCT_MIN = 40;
const PCT_MAX = 100;

/** Hiérarchie décroissante : un profil couvre tout ce qui est à son niveau ou en dessous. */
const RANG_EQUIPEMENT: Record<EquipmentType, number> = {
  poids_corps: 0,
  halteres_seuls: 1,
  home_gym: 2,
  salle_complete: 3,
};

/** Répartition des séances sur la semaine (`sessions.jour`, 1 = lundi). */
const CRENEAUX_JOUR: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

const LIBELLE_OBJECTIF: Record<GoalType, string> = {
  hyrox: 'Hyrox',
  marathon_muscu: 'Marathon & muscu',
  recomposition: 'Recomposition',
  performance: 'Performance',
};

/**
 * Libellés courts des phases, pour la structure du bloc affichée en A6.
 * Une clé absente retombe sur une dérivation automatique.
 */
const LIBELLE_PHASE: Record<string, string> = {
  phase_1_accumulation: 'Accumulation',
  phase_2_intensification: 'Intensification',
  phase_3_peak: 'Peak',
  deload_1: 'Deload',
  deload_2: 'Deload',
  taper: 'Taper',
  phase_A_fondations: 'Fondations',
  phase_B_introduction_fonctionnelle: 'Fonctionnel',
  phase_C_premiere_specialisation: 'Spécialisation',
};

const NOTE_SUBSTITUTION = 'Charge à ajuster au ressenti — exercice substitué.';

const LIBELLE_ZONE: Record<BodyZone, string> = {
  epaule: 'ton épaule',
  coude: 'ton coude',
  poignet: 'ton poignet',
  dos_bas: 'ton bas du dos',
  hanche: 'ta hanche',
  genou: 'ton genou',
  cheville: 'ta cheville',
};

/** Affichée à l'utilisateur : un exercice contre-indiqué ne doit jamais passer en silence. */
const noteContreIndication = (zone: BodyZone): string =>
  `Sollicite ${LIBELLE_ZONE[zone]} — adapte l'amplitude ou remplace ce mouvement.`;

/** Débutant : ce jour n'apparaît qu'en phase B, remplacé avant par un jour de fondamentaux. */
const JOUR_PHASE_B = 'fonctionnel_leger';
const JOUR_REMPLACEMENT_PHASE_B = 'fondamentaux';
const PREMIERE_SEMAINE_PHASE_B = 5;

// ── Utilitaires ──────────────────────────────────────────────────────────────

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const arrondiCharge = (kg: number): number =>
  Math.round(kg / PAS_CHARGE_KG) * PAS_CHARGE_KG;

function isPhase(v: unknown): v is ProgressionPhase {
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray((v as { semaines?: unknown }).semaines)
  );
}

function libellePhase(cle: string): string {
  const connu = LIBELLE_PHASE[cle];
  if (connu) return connu;
  const dernier = cle.split('_').pop() ?? cle;
  return dernier.charAt(0).toUpperCase() + dernier.slice(1);
}

function isIntensityPhase(p: ProgressionPhase): p is IntensityPhase {
  return Array.isArray((p as IntensityPhase).pct_1rm);
}

/** La phase active pour une semaine, et l'index de la semaine dans cette phase. */
function phasePourSemaine(
  progression: Record<string, unknown>,
  semaine: number,
): { phase: ProgressionPhase; index: number } {
  for (const valeur of Object.values(progression)) {
    if (!isPhase(valeur)) continue; // ignore les clés de documentation (`regle`, ...)
    const index = valeur.semaines.indexOf(semaine);
    if (index !== -1) return { phase: valeur, index };
  }
  throw new Error(`Aucune phase de progression ne couvre la semaine ${semaine}.`);
}

type RepsKind = 'reps' | 'duree_sec' | 'distance_m';

/**
 * `reps_cible` est un texte libre : "10", "12 par jambe", "45 sec", "20m".
 * On isole le nombre de tête pour pouvoir l'incrémenter sans perdre le suffixe.
 */
function parseRepsCible(
  reps: string,
): { valeur: number; separateur: string; suffixe: string; kind: RepsKind } | null {
  const m = /^(\d+)(\s*)(.*)$/.exec(reps.trim());
  if (!m) return null;
  const suffixe = m[3];
  const kind: RepsKind = /^sec/i.test(suffixe)
    ? 'duree_sec'
    : /^m$/i.test(suffixe)
      ? 'distance_m'
      : 'reps';
  return { valeur: Number(m[1]), separateur: m[2], suffixe, kind };
}

const formatRepsCible = (
  valeur: number,
  separateur: string,
  suffixe: string,
): string => `${valeur}${separateur}${suffixe}`;

const couvreEquipement = (profil: EquipmentType, requis: EquipmentType): boolean =>
  RANG_EQUIPEMENT[profil] >= RANG_EQUIPEMENT[requis];

const zoneTouchee = (ex: Exercise, limitations: BodyZone[]): BodyZone | null =>
  ex.zones_sollicitees.find((z) => limitations.includes(z)) ?? null;

// ── Résolution des exercices ─────────────────────────────────────────────────

type Resolution = {
  /** L'exercice finalement retenu — l'original si aucune substitution n'a eu lieu. */
  exercise: Exercise;
  substitue: boolean;
  /** Zone limitée que l'exercice servi sollicite malgré tout, s'il y en a une. */
  zoneResiduelle: BodyZone | null;
};

/**
 * Résout un slug une seule fois pour tout le programme : ni les limitations ni
 * l'équipement ne changent d'une semaine à l'autre. Évite 12 passes identiques
 * et 12 warnings dupliqués pour un même trou de données.
 *
 * Deux sauts au maximum : blessure, puis équipement.
 */
function resoudreExercice(
  slug: string,
  profile: GeneratorProfile,
  catalogue: Map<string, Exercise>,
  substituts: Map<string, Substitution[]>,
  warn: (w: GenerationWarning) => void,
  occupes: Set<string>,
): Resolution | null {
  const origine = catalogue.get(slug);
  if (!origine) {
    warn({
      code: 'exercice_introuvable',
      exercise_slug: slug,
      raison: null,
      message: `L'exercice « ${slug} » est prescrit par le template mais absent du catalogue. Bloc écarté.`,
    });
    return null;
  }

  // Les slugs déjà traversés : sans ce garde-fou, une chaîne peut revenir sur
  // l'exercice d'origine (bulgarian-split-squat → hip-thrust → bulgarian-split-squat)
  // et faire passer pour une substitution ce qui n'en est pas une.
  const visites = new Set<string>([origine.slug]);

  const meilleurSubstitut = (depuis: Exercise, raison: string): Exercise | null => {
    const candidats = [...(substituts.get(`${depuis.slug}|${raison}`) ?? [])]
      .sort((a, b) => a.priorite - b.priorite)
      .map((c) => catalogue.get(c.substitut_slug))
      // `occupes` : un substitut déjà présent dans la séance produirait deux
      // fois le même mouvement — toujours faux, donc filtre dur, pas préférence.
      .filter(
        (e): e is Exercise => e !== undefined && !visites.has(e.slug) && !occupes.has(e.slug),
      );

    // Un substitut qui sollicite encore une zone limitée ne règle rien : on ne
    // s'en contente qu'à défaut, jamais avant un candidat réellement sain.
    return candidats.find((e) => !zoneTouchee(e, profile.limitations)) ?? candidats[0] ?? null;
  };

  let courant = origine;
  let substitue = false;

  // Saut 1 — blessure.
  const zone = zoneTouchee(courant, profile.limitations);
  if (zone) {
    const raison = `limitation_${zone}`;
    const sub = meilleurSubstitut(courant, raison);
    if (sub) {
      courant = sub;
      visites.add(sub.slug);
      substitue = true;
    } else {
      warn({
        code: 'substitut_introuvable',
        exercise_slug: courant.slug,
        raison,
        message: `« ${courant.nom} » sollicite la zone « ${zone} » déclarée en limitation, et aucun substitut exploitable n'existe pour la raison « ${raison} ». L'exercice d'origine est conservé tel quel.`,
      });
    }
  }

  // Saut 2 — équipement, sur le résultat du saut 1.
  if (!couvreEquipement(profile.equipement, courant.equipement_requis)) {
    const sub = meilleurSubstitut(courant, 'equipement_absent');
    if (sub && couvreEquipement(profile.equipement, sub.equipement_requis)) {
      courant = sub;
      visites.add(sub.slug);
      substitue = true;
    } else {
      warn({
        code: 'substitut_equipement_introuvable',
        exercise_slug: courant.slug,
        raison: 'equipement_absent',
        message: `« ${courant.nom} » demande « ${courant.equipement_requis} », le profil dispose de « ${profile.equipement} », et aucun substitut compatible n'existe. L'exercice est conservé tel quel.`,
      });
    }
  }

  // Contrôle final : le substitut épargne-t-il vraiment la zone limitée ?
  // On ne le signale que si une substitution a bien eu lieu — sinon le cas est
  // déjà couvert par le warning `substitut_introuvable` ci-dessus.
  if (substitue) {
    const residuelle = zoneTouchee(courant, profile.limitations);
    if (residuelle) {
      warn({
        code: 'substitut_toujours_contre_indique',
        exercise_slug: origine.slug,
        raison: `limitation_${residuelle}`,
        message: `« ${origine.nom} » a été substitué par « ${courant.nom} », qui sollicite lui aussi la zone « ${residuelle} ». Substitut conservé : soit la ligne de substitution est à revoir, soit zones_sollicitees est trop grossier pour « ${courant.slug} ».`,
      });
    }
  }

  return { exercise: courant, substitue, zoneResiduelle: zoneTouchee(courant, profile.limitations) };
}

// ── Génération ───────────────────────────────────────────────────────────────

/** Les jours du pool retenus, dans l'ordre de priorité de l'objectif. */
function selectionnerJours(template: LevelTemplate, modifier: ObjectifModifier, jours: number): TemplateDay[] {
  const parId = new Map(template.pool_jours.map((j) => [j.id, j]));
  const retenus: TemplateDay[] = [];

  for (const id of modifier.ordre.slice(0, jours)) {
    const jour = parId.get(id);
    if (!jour) throw new Error(`Le jour « ${id} » figure dans l'ordre de l'objectif mais pas dans pool_jours.`);
    retenus.push(jour);
  }

  // jours_dispo > taille du pool : on complète par du repos actif (selection_rule des templates).
  while (retenus.length < jours) {
    retenus.push({
      id: 'repos_actif',
      nom: 'Repos actif',
      type: 'repos',
      duree_estimee_min: 30,
      blocs_semaine_1: [
        { ordre: 1, notes: 'Marche, mobilité ou vélo très souple. Aucun travail à intensité.' },
      ],
    });
  }

  return retenus;
}

/** Débutant : `fonctionnel_leger` ne démarre qu'en phase B. */
function jourPourSemaine(
  jour: TemplateDay,
  semaine: number,
  niveau: LevelType,
  parId: Map<string, TemplateDay>,
): TemplateDay {
  if (niveau !== 'debutant' || jour.id !== JOUR_PHASE_B || semaine >= PREMIERE_SEMAINE_PHASE_B) return jour;
  return parId.get(JOUR_REMPLACEMENT_PHASE_B) ?? jour;
}

/** Charge en kg à partir du 1RM déclaré, ou null si la référence manque. */
function chargeCible(
  slug: string,
  pct: number,
  profile: GeneratorProfile,
  warn: (w: GenerationWarning) => void,
  dejaSignale: Set<string>,
): number | null {
  const ref = REF_1RM[slug];
  if (!ref) return null;

  const valeur =
    ref.ref === 'squat' ? profile.squat_1rm
    : ref.ref === 'bench' ? profile.bench_1rm
    : profile.deadlift_1rm;

  if (valeur === null || valeur === undefined || valeur <= 0) {
    if (!dejaSignale.has(slug)) {
      dejaSignale.add(slug);
      warn({
        code: '1rm_manquant',
        exercise_slug: slug,
        raison: null,
        message: `« ${slug} » est prescrit en %1RM mais ${ref.ref}_1rm n'est pas renseigné sur le profil. Le %1RM est conservé, la charge en kg reste indéterminée.`,
      });
    }
    return null;
  }

  return arrondiCharge((valeur * ref.coef * pct) / 100);
}

type Baseline = { pct: number; rpe: number };

/** Applique la progression de la semaine à un bloc du template. */
function construireBloc(
  tpl: TemplateBlock,
  semaine: number,
  template: LevelTemplate,
  baseline: Baseline | null,
  resolutions: Map<string, Resolution | null>,
  profile: GeneratorProfile,
  warn: (w: GenerationWarning) => void,
  dejaSignale: Set<string>,
): GeneratedBlock | null {
  let slug: string | null = null;
  let substitue = false;
  let zoneResiduelle: BodyZone | null = null;

  if (tpl.exercise_slug) {
    const resolution = resolutions.get(tpl.exercise_slug);
    if (!resolution) return null; // exercice introuvable, déjà signalé
    slug = resolution.exercise.slug;
    substitue = resolution.substitue;
    zoneResiduelle = resolution.zoneResiduelle;
  }

  const { phase, index } = phasePourSemaine(template.progression, semaine);

  let series = tpl.series ?? null;
  let reps_cible = tpl.reps_cible ?? null;
  let duree_sec = tpl.duree_sec ?? null;
  let pct_1rm: number | null = null;
  let rpe: number | null = tpl.rpe ?? null;

  if (isIntensityPhase(phase)) {
    // Les valeurs de phase s'appliquent en ÉCART, pas en remplacement : quand un
    // template prescrit le deadlift à RPE 7 là où la phase annonce 6, l'écart
    // traduit une intention de coaching qu'un remplacement sec écraserait.
    if (series !== null) series = Math.max(1, Math.round(series * phase.volume_modifier));
    if (tpl.pct_1rm !== undefined && baseline) {
      pct_1rm = clamp(phase.pct_1rm[index] + (tpl.pct_1rm - baseline.pct), PCT_MIN, PCT_MAX);
    }
    if (tpl.rpe !== undefined && baseline) {
      rpe = clamp(phase.rpe[index] + (tpl.rpe - baseline.rpe), 1, 10);
    }
  } else {
    // Débutant : incréments additifs sur la valeur de base, aucun %1RM à ce niveau.
    if (reps_cible !== null) {
      const parsed = parseRepsCible(reps_cible);
      if (parsed) {
        const increment =
          parsed.kind === 'duree_sec' ? phase.increment_duree_sec[index]
          : parsed.kind === 'distance_m' ? phase.increment_distance_m[index]
          : phase.increment_reps[index];
        reps_cible = formatRepsCible(parsed.valeur + increment, parsed.separateur, parsed.suffixe);
      }
    }
    if (duree_sec !== null) duree_sec += phase.increment_cardio_min[index] * 60;
  }

  // Un substitut ne se charge pas comme l'original, même à pattern identique :
  // la fausse précision est pire que l'absence de précision.
  let charge_kg: number | null = null;
  if (substitue) {
    pct_1rm = null;
  } else if (pct_1rm !== null && slug !== null) {
    charge_kg = chargeCible(slug, pct_1rm, profile, warn, dejaSignale);
  }

  // La note du template décrit le mouvement d'origine (« sur les genoux si besoin »
  // pour des pompes) : la laisser sur le substitut serait trompeur.
  // La contre-indication passe en premier — c'est la seule note qui engage la sécurité.
  const notes =
    [
      zoneResiduelle ? noteContreIndication(zoneResiduelle) : null,
      substitue ? NOTE_SUBSTITUTION : (tpl.notes ?? null),
    ]
      .filter(Boolean)
      .join(' ') || null;

  return {
    ordre: tpl.ordre,
    exercise_slug: slug,
    series,
    reps_cible,
    pct_1rm,
    rpe,
    repos_sec: tpl.repos_sec ?? null,
    cardio_type: tpl.cardio_type ?? null,
    duree_sec,
    distance_m: tpl.distance_m ?? null,
    intervalles: tpl.intervalles ?? null,
    notes,
    charge_kg,
    contre_indication: zoneResiduelle,
  };
}

/** Débutant : l'objectif de la phase pédagogique active, ajouté à la note de coaching. */
function notePhase(template: LevelTemplate, semaine: number): string | null {
  if (!template.phases) return null;
  for (const p of Object.values(template.phases)) {
    if (p.semaines.includes(semaine)) return p.objectif;
  }
  return null;
}

/**
 * Génère les 12 semaines d'un programme à partir du profil.
 *
 * Échoue bruyamment sur un défaut structurel (niveau ou objectif inconnu,
 * jours_dispo hors bornes) ; remonte les trous de données en `warnings` et
 * produit quand même le programme.
 */
export function generateProgram(input: GeneratorInput): GeneratedProgram {
  const { profile, templates, exercises, substitutions } = input;

  const template = templates[profile.niveau];
  if (!template) throw new Error(`Aucun template pour le niveau « ${profile.niveau} ».`);

  const modifier = template.objectif_modifiers[profile.objectif];
  if (!modifier) {
    throw new Error(
      `L'objectif « ${profile.objectif} » est absent de objectif_modifiers du template « ${template.template_id} ».`,
    );
  }

  const jours = profile.jours_dispo;
  if (!Number.isInteger(jours) || !CRENEAUX_JOUR[jours]) {
    throw new Error(`jours_dispo doit être un entier entre 2 et 7, reçu « ${jours} ».`);
  }

  const warnings: GenerationWarning[] = [];
  const warn = (w: GenerationWarning): void => {
    warnings.push(w);
  };

  const catalogue = new Map(exercises.map((e) => [e.slug, e]));
  const substituts = new Map<string, Substitution[]>();
  for (const s of substitutions) {
    const cle = `${s.exercise_slug}|${s.raison}`;
    const liste = substituts.get(cle);
    if (liste) liste.push(s);
    else substituts.set(cle, [s]);
  }

  const joursRetenus = selectionnerJours(template, modifier, jours);
  const parId = new Map(template.pool_jours.map((j) => [j.id, j]));
  const creneaux = CRENEAUX_JOUR[jours];

  // Le jour effectivement programmé peut varier selon la semaine (règle phase B
  // du débutant) : on parcourt les 12 semaines pour connaître l'ensemble exact
  // des exercices à résoudre.
  const planning: TemplateDay[][] = [];
  for (let semaine = 1; semaine <= DUREE_SEMAINES; semaine++) {
    planning.push(joursRetenus.map((j) => jourPourSemaine(j, semaine, profile.niveau, parId)));
  }

  // Résolution par jour, pas globale : limitations et équipement sont invariants
  // d'une semaine à l'autre, mais « ce mouvement est-il déjà dans la séance ? »
  // dépend du jour. Résoudre une fois par jour distinct suffit.
  const joursDistincts = new Map<string, TemplateDay>();
  for (const semaineJours of planning) {
    for (const jour of semaineJours) joursDistincts.set(jour.id, jour);
  }

  const resolutionsParJour = new Map<string, Map<string, Resolution | null>>();
  for (const [id, jour] of joursDistincts) {
    // Les slugs prescrits par la séance sont réservés d'emblée : un substitut ne
    // doit pas prendre la place d'un mouvement qui viendra de toute façon plus bas.
    const occupes = new Set(
      jour.blocs_semaine_1.map((b) => b.exercise_slug).filter((v): v is string => Boolean(v)),
    );
    const parSlug = new Map<string, Resolution | null>();

    for (const bloc of [...jour.blocs_semaine_1].sort((a, b) => a.ordre - b.ordre)) {
      if (!bloc.exercise_slug) continue;
      occupes.delete(bloc.exercise_slug); // un exercice n'est pas son propre doublon
      const resolution = resoudreExercice(
        bloc.exercise_slug,
        profile,
        catalogue,
        substituts,
        warn,
        occupes,
      );
      if (resolution) occupes.add(resolution.exercise.slug);
      parSlug.set(bloc.exercise_slug, resolution);
    }

    resolutionsParJour.set(id, parSlug);
  }

  // Plusieurs blocs d'une même séance peuvent converger vers le même exercice
  // après substitution — quatre séries identiques d'affilée ne sont pas une séance.
  const joursVerifies = new Set<string>();
  for (const semaineJours of planning) {
    for (const jour of semaineJours) {
      if (joursVerifies.has(jour.id)) continue;
      joursVerifies.add(jour.id);

      const resolutions = resolutionsParJour.get(jour.id);
      const compte = new Map<string, number>();
      for (const bloc of jour.blocs_semaine_1) {
        if (!bloc.exercise_slug) continue;
        const resolution = resolutions?.get(bloc.exercise_slug);
        if (!resolution) continue;
        const slug = resolution.exercise.slug;
        compte.set(slug, (compte.get(slug) ?? 0) + 1);
      }

      for (const [slug, n] of compte) {
        if (n < 2) continue;
        warn({
          code: 'doublon_dans_seance',
          exercise_slug: slug,
          raison: null,
          message: `La séance « ${jour.nom} » contient ${n} blocs qui aboutissent tous à « ${catalogue.get(slug)?.nom ?? slug} » après substitution. Séance inexploitable en l'état : il manque des substituts distincts pour ce profil.`,
        });
      }
    }
  }

  const semaine1 = phasePourSemaine(template.progression, 1);
  const baseline: Baseline | null = isIntensityPhase(semaine1.phase)
    ? { pct: semaine1.phase.pct_1rm[semaine1.index], rpe: semaine1.phase.rpe[semaine1.index] }
    : null;

  const dejaSignale = new Set<string>();
  const sessions: GeneratedSession[] = [];

  for (let semaine = 1; semaine <= DUREE_SEMAINES; semaine++) {
    planning[semaine - 1].forEach((jour, i) => {
      const resolutions = resolutionsParJour.get(jour.id) ?? new Map<string, Resolution | null>();
      const blocks = jour.blocs_semaine_1
        .map((b) => construireBloc(b, semaine, template, baseline, resolutions, profile, warn, dejaSignale))
        .filter((b): b is GeneratedBlock => b !== null);

      const note = i === 0
        ? [modifier.note_coaching, notePhase(template, semaine)].filter(Boolean).join(' ')
        : null;

      sessions.push({
        semaine,
        jour: creneaux[i],
        type: jour.type,
        nom: jour.nom,
        duree_estimee_min: jour.duree_estimee_min,
        note_coaching: note || null,
        blocks,
      });
    });
  }

  const phases: ProgramPhase[] = Object.entries(template.progression)
    .filter((e): e is [string, ProgressionPhase] => isPhase(e[1]))
    .map(([cle, p]) => ({
      label: libellePhase(cle),
      de: Math.min(...p.semaines),
      a: Math.max(...p.semaines),
    }))
    .sort((a, b) => a.de - b.de);

  // Un exercice présent dans plusieurs jours produit le même avertissement
  // autant de fois : on ne garde qu'une occurrence de chaque message.
  const vus = new Set<string>();
  const warningsUniques = warnings.filter((w) => {
    const cle = `${w.code}|${w.message}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });

  return {
    program: {
      nom: `Bloc ${LIBELLE_OBJECTIF[profile.objectif]} — ${DUREE_SEMAINES} semaines`,
      objectif: profile.objectif,
      niveau: profile.niveau,
      duree_semaines: DUREE_SEMAINES,
      jours_par_semaine: jours,
    },
    sessions,
    phases,
    warnings: warningsUniques,
    ratio_muscu_cardio: modifier.ratio_muscu_cardio,
  };
}
