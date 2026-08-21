-- ============================================================
-- HYBRID CLUB — Migration 004
-- Nouvel exercice core sans charge d'épaule + substitutions manquantes
-- ============================================================

insert into exercises (slug, nom, pattern, equipement_requis, muscles_primaires, zones_sollicitees, is_unilateral) values
('dead-bug', 'Dead bug', 'core', 'poids_corps', '{core}', '{dos_bas}', false);

insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_epaule', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('plank', 'dead-bug'),
  ('hanging-leg-raise', 'dead-bug'),
  ('lat-pulldown', 'chest-supported-row'),
  ('wall-ball', 'kettlebell-swing')
);