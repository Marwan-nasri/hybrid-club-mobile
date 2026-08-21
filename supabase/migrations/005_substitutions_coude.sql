-- ============================================================
-- HYBRID CLUB — Migration 005
-- Comblement du trou "coude" identifié par l'audit
-- ============================================================

-- Aucun mouvement de tirage du catalogue n'épargnait le coude : tous les
-- rows et pulldowns passent par une flexion de coude chargée. Le tirage
-- bras tendus travaille le grand dorsal coudes quasi verrouillés.
insert into exercises (slug, nom, pattern, equipement_requis, muscles_primaires, zones_sollicitees, is_unilateral) values
('straight-arm-pulldown', 'Tirage bras tendus', 'pull_vertical', 'salle_complete', '{dos}', '{epaule}', false);

-- Priorité 1 : premier choix
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_coude', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('bench-press', 'chest-press-machine'),
  ('push-up', 'chest-press-machine'),
  ('overhead-press', 'landmine-press'),
  ('dumbbell-shoulder-press', 'landmine-press'),
  ('lat-pulldown', 'straight-arm-pulldown'),
  ('pull-up', 'straight-arm-pulldown'),
  ('inverted-row', 'straight-arm-pulldown'),
  ('barbell-row', 'straight-arm-pulldown'),
  ('triceps-pushdown', 'lateral-raise'),
  ('hammer-curl', 'lateral-raise')
);

-- Priorité 2 : repli quand le premier choix est déjà pris dans la séance
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_coude', 2
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('bench-press', 'cable-fly'),
  ('push-up', 'cable-fly'),
  ('dips', 'cable-fly'),
  ('close-grip-bench', 'cable-fly'),
  ('lat-pulldown', 'lateral-raise'),
  ('pull-up', 'lateral-raise')
);