-- ============================================================
-- HYBRID CLUB — Migration 002
-- Substitutions manquantes identifiées par le croisement templates × seed
-- ============================================================

-- Substitutions pour limitation POIGNET
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_poignet', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('front-squat', 'goblet-squat'),        -- pas d'appui poignet en rack avant
  ('push-up', 'chest-press-machine'),      -- aucune charge sur le poignet
  ('barbell-curl', 'hammer-curl'),         -- prise neutre, moins de contrainte
  ('farmers-carry', 'sled-push'),          -- même intention fonctionnelle, sans grip lourd
  ('burpee-broad-jump', 'kettlebell-swing') -- retire l'appui au sol
);

-- Substitutions pour limitation HANCHE
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_hanche', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('back-squat', 'leg-press'),                  -- guidé, moins d'amplitude de hanche
  ('bulgarian-split-squat', 'leg-press'),        -- retire la flexion de hanche profonde
  ('deadlift', 'back-extension'),                -- charge axiale réduite
  ('romanian-deadlift', 'back-extension'),       -- même pattern, charge allégée
  ('hip-thrust', 'leg-press'),                   -- quadriceps-dominant, épargne l'extension de hanche lourde
  ('kettlebell-swing', 'sled-push')              -- retire le hinge balistique, garde l'intention conditioning
);

-- Substitutions pour limitation CHEVILLE
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_cheville', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('standing-calf-raise', 'seated-calf-raise'),  -- retire la charge en dorsiflexion debout
  ('seated-calf-raise', 'plank')                 -- si même la version assise pose problème, on retire le mollet du programme
);

-- Substitutions ÉQUIPEMENT ABSENT manquantes
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'equipement_absent', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('romanian-deadlift', 'kettlebell-swing'),     -- hinge pattern, halteres_seuls
  ('hip-thrust', 'bulgarian-split-squat'),       -- dominante fessiers, halteres_seuls
  ('overhead-press', 'dumbbell-shoulder-press'), -- même pattern, halteres_seuls
  ('sled-push', 'burpee-broad-jump'),            -- puissance fonctionnelle, poids_corps
  ('wall-ball', 'kettlebell-swing')               -- puissance fonctionnelle, halteres_seuls
);