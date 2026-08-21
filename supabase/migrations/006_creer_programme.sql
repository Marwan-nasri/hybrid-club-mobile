-- ============================================================
-- HYBRID CLUB — Migration 006
-- Insertion atomique d'un programme généré
-- ============================================================

-- Le client Supabase ne sait pas ouvrir de transaction : trois insert-into
-- séparés laisseraient un `programs` orphelin si les `sessions` échouent.
-- Une fonction plpgsql est un seul énoncé côté serveur, donc une seule
-- transaction : tout passe ou rien ne passe.
--
-- SECURITY INVOKER (défaut) : la RLS s'applique normalement, la fonction
-- n'écrit que pour auth.uid(). Aucun user_id n'est accepté en paramètre.

create or replace function creer_programme(programme jsonb)
returns uuid
language plpgsql
as $$
declare
  v_program_id uuid;
  v_inconnus text[];
begin
  if auth.uid() is null then
    raise exception 'creer_programme exige un utilisateur authentifié';
  end if;

  -- Un slug absent du catalogue produirait un exercise_id null (le left join
  -- ci-dessous ne le signalerait pas) : une séance sans exercice, silencieuse.
  select array_agg(distinct t.slug) into v_inconnus
  from (
    select b->>'exercise_slug' as slug
    from jsonb_array_elements(programme->'sessions') s
    cross join lateral jsonb_array_elements(s->'blocks') b
  ) t
  where t.slug is not null
    and not exists (select 1 from exercises e where e.slug = t.slug);

  if v_inconnus is not null then
    raise exception 'slugs absents du catalogue : %', array_to_string(v_inconnus, ', ');
  end if;

  insert into programs (user_id, nom, objectif, niveau, duree_semaines, jours_par_semaine, is_active)
  values (
    auth.uid(),
    programme->>'nom',
    (programme->>'objectif')::goal_type,
    (programme->>'niveau')::level_type,
    (programme->>'duree_semaines')::smallint,
    (programme->>'jours_par_semaine')::smallint,
    true
  )
  returning id into v_program_id;

  -- Un seul programme actif à la fois : les précédents passent en archive.
  update programs
     set is_active = false
   where user_id = auth.uid() and id <> v_program_id and is_active;

  insert into sessions (program_id, semaine, jour, type, nom, duree_estimee_min, note_coaching)
  select
    v_program_id,
    (seance->>'semaine')::smallint,
    (seance->>'jour')::smallint,
    (seance->>'type')::session_type,
    seance->>'nom',
    (seance->>'duree_estimee_min')::smallint,
    seance->>'note_coaching'
  from jsonb_array_elements(programme->'sessions') seance;

  -- Énoncé séparé, et non une CTE modifiante enchaînée sur l'insert ci-dessus :
  -- la policy `blocs_via_session` vérifie que la séance parente existe et
  -- appartient à auth.uid(). Toutes les parties d'un même énoncé partagent le
  -- snapshot pris à son début, donc les séances tout juste insérées y seraient
  -- invisibles et le contrôle RLS échouerait (42501). Un énoncé suivant, dans
  -- la même transaction, voit bien ce que le précédent a écrit.
  insert into session_blocks (
    session_id, exercise_id, ordre,
    series, reps_cible, pct_1rm, rpe, repos_sec,
    cardio_type, distance_m, duree_sec, intervalles, notes
  )
  select
    s.id,
    ex.id,
    (b->>'ordre')::smallint,
    (b->>'series')::smallint,
    b->>'reps_cible',
    (b->>'pct_1rm')::smallint,
    (b->>'rpe')::smallint,
    (b->>'repos_sec')::smallint,
    (b->>'cardio_type')::cardio_type,
    (b->>'distance_m')::integer,
    (b->>'duree_sec')::integer,
    case when b->'intervalles' = 'null'::jsonb then null else b->'intervalles' end,
    b->>'notes'
  from jsonb_array_elements(programme->'sessions') seance
  join sessions s
    on s.program_id = v_program_id
   and s.semaine = (seance->>'semaine')::smallint
   and s.jour = (seance->>'jour')::smallint
  cross join lateral jsonb_array_elements(seance->'blocks') b
  left join exercises ex on ex.slug = b->>'exercise_slug';

  return v_program_id;
end;
$$;

comment on function creer_programme(jsonb) is
  'Insère un programme généré (programs + sessions + session_blocks) en une transaction. '
  'La charge en kg n''est jamais persistée : pct_1rm est la prescription.';

grant execute on function creer_programme(jsonb) to authenticated;
