-- ============================================================
-- HYBRID CLUB — Migration 007
-- creer_programme écrit aussi profiles, et fixe date_debut
-- ============================================================

-- Deux trous comblés en même temps, tous deux dans creer_programme :
--
-- 1. `profiles` n'était rempli par personne. Le trigger `handle_new_user`
--    (migration 001) insère une ligne vide à l'inscription, et rien ne la
--    complétait ensuite : le profil du quiz vivait dans AsyncStorage, était
--    consommé pour générer le programme, puis effacé. 1RM, anthropométrie,
--    limitations et prénom étaient définitivement perdus.
--
-- 2. `date_debut` retombait sur son défaut `current_date`, évalué dans le
--    fuseau du serveur — UTC. Une inscription à 00 h 58 à Paris datait donc le
--    programme de la veille. Tout le calcul de semaine de l'onglet Aujourd'hui
--    part de cette colonne : l'écart d'un jour décale l'affichage d'une semaine
--    entière quand l'inscription tombe un lundi. La date locale de l'appareil
--    est désormais envoyée dans le payload.
--
-- Le profil arrive sous `programme->'profil'`. Il est optionnel : un appelant
-- qui ne l'envoie pas (le script test:insertion) insère son programme comme
-- avant, sans toucher à `profiles`.

create or replace function creer_programme(programme jsonb)
returns uuid
language plpgsql
as $$
declare
  v_program_id uuid;
  v_inconnus text[];
  v_profil jsonb := programme->'profil';
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

  -- ── Profil ────────────────────────────────────────────────────────────────
  -- `insert on conflict` plutôt qu'un `update` : si le trigger n'a pas tourné
  -- (compte créé avant sa mise en place), un update ne toucherait aucune ligne
  -- et échouerait en silence.
  if v_profil is not null then
    insert into profiles (
      id, prenom, objectif, niveau, jours_dispo, equipement, limitations,
      poids_kg, taille_cm, date_naissance,
      squat_1rm, bench_1rm, deadlift_1rm, temps_5k_sec,
      onboarding_complete
    )
    values (
      auth.uid(),
      v_profil->>'prenom',
      (v_profil->>'objectif')::goal_type,
      (v_profil->>'niveau')::level_type,
      (v_profil->>'jours_dispo')::smallint,
      (v_profil->>'equipement')::equipment_type,
      coalesce(
        (select array_agg(z::body_zone)
           from jsonb_array_elements_text(v_profil->'limitations') z),
        '{}'::body_zone[]
      ),
      (v_profil->>'poids_kg')::numeric,
      (v_profil->>'taille_cm')::smallint,
      (v_profil->>'date_naissance')::date,
      (v_profil->>'squat_1rm')::numeric,
      (v_profil->>'bench_1rm')::numeric,
      (v_profil->>'deadlift_1rm')::numeric,
      (v_profil->>'temps_5k_sec')::integer,
      true
    )
    on conflict (id) do update set
      prenom              = excluded.prenom,
      objectif            = excluded.objectif,
      niveau              = excluded.niveau,
      jours_dispo         = excluded.jours_dispo,
      equipement          = excluded.equipement,
      limitations         = excluded.limitations,
      poids_kg            = excluded.poids_kg,
      taille_cm           = excluded.taille_cm,
      date_naissance      = excluded.date_naissance,
      squat_1rm           = excluded.squat_1rm,
      bench_1rm           = excluded.bench_1rm,
      deadlift_1rm        = excluded.deadlift_1rm,
      temps_5k_sec        = excluded.temps_5k_sec,
      onboarding_complete = true;
  end if;

  -- ── Programme ─────────────────────────────────────────────────────────────
  insert into programs (
    user_id, nom, objectif, niveau, duree_semaines, jours_par_semaine,
    date_debut, is_active
  )
  values (
    auth.uid(),
    programme->>'nom',
    (programme->>'objectif')::goal_type,
    (programme->>'niveau')::level_type,
    (programme->>'duree_semaines')::smallint,
    (programme->>'jours_par_semaine')::smallint,
    -- Date locale de l'appareil. `current_date` en repli reste faux d'un jour
    -- en soirée, mais vaut mieux qu'un null sur une colonne not null.
    coalesce((programme->>'date_debut')::date, current_date),
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
  'Insère un programme généré (profiles + programs + sessions + session_blocks) en une transaction. '
  'La charge en kg n''est jamais persistée : pct_1rm est la prescription. '
  'date_debut vient du client (date locale) ; profiles n''est écrit que si le payload porte « profil ».';
