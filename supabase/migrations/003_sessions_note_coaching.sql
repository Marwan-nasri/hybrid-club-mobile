-- ============================================================
-- HYBRID CLUB — Migration 003
-- Note de coaching sur la séance
-- ============================================================

-- Le moteur de génération produit une note par semaine (note_coaching de
-- l'objectif, plus l'objectif de la phase pédagogique au niveau débutant),
-- portée par la première séance de la semaine. `sessions` n'avait aucune
-- colonne pour l'accueillir : la note ne survivait pas à l'insertion.

alter table sessions add column note_coaching text;
