-- ============================================================
-- HYBRID CLUB — Schéma initial
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. TYPES ÉNUMÉRÉS
-- ============================================================

create type goal_type as enum ('hyrox', 'marathon_muscu', 'recomposition', 'performance');
create type level_type as enum ('debutant', 'intermediaire', 'avance');
create type session_type as enum ('muscu', 'cardio', 'hybride', 'repos');
create type movement_pattern as enum (
  'squat', 'hinge', 'push_horizontal', 'push_vertical',
  'pull_horizontal', 'pull_vertical', 'lunge', 'carry', 'core', 'isolation'
);
create type cardio_type as enum ('course', 'rameur', 'assault_bike', 'ski_erg', 'velo', 'marche_inclinee');
create type body_zone as enum ('epaule', 'coude', 'poignet', 'dos_bas', 'hanche', 'genou', 'cheville');
create type workout_status as enum ('en_cours', 'termine', 'abandonne');
create type equipment_type as enum ('salle_complete', 'home_gym', 'halteres_seuls', 'poids_corps');

-- ============================================================
-- 2. PROFILS UTILISATEUR
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  prenom text,
  objectif goal_type,
  niveau level_type,
  jours_dispo smallint check (jours_dispo between 2 and 7),
  ratio_muscu_cardio smallint default 50 check (ratio_muscu_cardio between 0 and 100),
  equipement equipment_type default 'salle_complete',
  limitations body_zone[] default '{}',

  -- Anthropométrie
  poids_kg numeric(5,2),
  taille_cm smallint,
  date_naissance date,

  -- Benchmarks initiaux (optionnels, saisis à l'onboarding)
  squat_1rm numeric(5,1),
  bench_1rm numeric(5,1),
  deadlift_1rm numeric(5,1),
  temps_5k_sec integer,

  -- Préférences
  unite_poids text default 'kg' check (unite_poids in ('kg', 'lb')),
  notifications_actives boolean default true,

  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 3. CATALOGUE D'EXERCICES  (données partagées, lecture seule)
-- ============================================================

create table exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nom text not null,
  pattern movement_pattern not null,
  equipement_requis equipment_type not null,
  muscles_primaires text[] default '{}',
  video_url text,
  consignes text,

  -- Zones à éviter si l'utilisateur a une limitation sur cette zone
  zones_sollicitees body_zone[] default '{}',

  is_unilateral boolean default false,
  created_at timestamptz default now()
);

-- Table de substitution : quel exercice remplacer par quoi, et pourquoi
create table exercise_substitutions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  substitut_id uuid not null references exercises(id) on delete cascade,
  raison text not null,           -- 'limitation_epaule', 'equipement_absent', etc.
  priorite smallint default 1,    -- 1 = meilleur substitut
  unique (exercise_id, substitut_id, raison)
);

-- ============================================================
-- 4. PROGRAMMES  (le PRESCRIT)
-- ============================================================

create table programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  nom text not null,
  objectif goal_type not null,
  niveau level_type not null,
  duree_semaines smallint not null default 12,
  jours_par_semaine smallint not null,

  date_debut date not null default current_date,
  is_active boolean default true,

  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,

  semaine smallint not null check (semaine between 1 and 52),
  jour smallint not null check (jour between 1 and 7),
  type session_type not null,
  nom text not null,
  duree_estimee_min smallint,

  unique (program_id, semaine, jour)
);

create table session_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,

  ordre smallint not null,

  -- Prescription musculation
  series smallint,
  reps_cible text,              -- '8-10', '5', 'AMRAP'
  pct_1rm smallint,             -- pourcentage du 1RM si applicable
  rpe smallint check (rpe between 1 and 10),
  repos_sec smallint,

  -- Prescription cardio
  cardio_type cardio_type,
  distance_m integer,
  duree_sec integer,
  allure_cible_sec_km integer,
  intervalles jsonb,            -- [{"effort_sec":60,"recup_sec":90,"repetitions":8}]

  notes text,

  unique (session_id, ordre)
);

-- ============================================================
-- 5. RÉALISÉ  (ce que l'utilisateur a effectivement fait)
-- ============================================================

create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,

  date_debut timestamptz not null default now(),
  date_fin timestamptz,
  duree_sec integer,
  statut workout_status default 'en_cours',

  volume_total_kg numeric(10,2),
  note text,
  ressenti smallint check (ressenti between 1 and 5),

  -- Identifiant généré côté client, pour la synchro offline
  client_uuid uuid unique,

  created_at timestamptz default now()
);

create table set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references workout_logs(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,

  serie smallint not null,
  reps smallint,
  charge_kg numeric(6,2),
  rpe smallint check (rpe between 1 and 10),

  is_echauffement boolean default false,
  completed_at timestamptz default now(),

  unique (workout_log_id, exercise_id, serie)
);

create table cardio_logs (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid references workout_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  type cardio_type not null,
  distance_m integer,
  duree_sec integer not null,
  allure_sec_km integer,
  fc_moyenne smallint,
  calories smallint,

  date timestamptz not null default now()
);

-- ============================================================
-- 6. RECORDS PERSONNELS
-- ============================================================

create table personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete cascade,
  cardio_type cardio_type,

  -- Un record est soit sur un exercice, soit sur un type de cardio
  constraint pr_target_check check (
    (exercise_id is not null and cardio_type is null) or
    (exercise_id is null and cardio_type is not null)
  ),

  type_record text not null,     -- '1rm_estime', 'charge_max', 'volume_seance', 'distance', 'temps'
  valeur numeric(10,2) not null,
  unite text not null,           -- 'kg', 'reps', 'sec', 'm'

  reps smallint,                 -- contexte pour un record de charge
  date_record timestamptz not null default now(),
  workout_log_id uuid references workout_logs(id) on delete set null,

  unique (user_id, exercise_id, cardio_type, type_record)
);

-- ============================================================
-- 7. INDEX
-- ============================================================

create index idx_programs_user_active on programs(user_id) where is_active;
create index idx_sessions_program on sessions(program_id, semaine, jour);
create index idx_session_blocks_session on session_blocks(session_id, ordre);
create index idx_workout_logs_user_date on workout_logs(user_id, date_debut desc);
create index idx_workout_logs_client_uuid on workout_logs(client_uuid);
create index idx_set_logs_workout on set_logs(workout_log_id);
create index idx_set_logs_exercise on set_logs(exercise_id);
create index idx_cardio_logs_user_date on cardio_logs(user_id, date desc);
create index idx_personal_records_user on personal_records(user_id);
create index idx_exercise_subs_exercise on exercise_substitutions(exercise_id, priorite);

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table exercises enable row level security;
alter table exercise_substitutions enable row level security;
alter table programs enable row level security;
alter table sessions enable row level security;
alter table session_blocks enable row level security;
alter table workout_logs enable row level security;
alter table set_logs enable row level security;
alter table cardio_logs enable row level security;
alter table personal_records enable row level security;

-- Profils : chacun ne voit et ne modifie que le sien
create policy "profils_lecture_propre" on profiles
  for select using (auth.uid() = id);
create policy "profils_insertion_propre" on profiles
  for insert with check (auth.uid() = id);
create policy "profils_maj_propre" on profiles
  for update using (auth.uid() = id);

-- Catalogue d'exercices : lecture pour tout utilisateur authentifié
create policy "exercices_lecture_publique" on exercises
  for select to authenticated using (true);
create policy "substitutions_lecture_publique" on exercise_substitutions
  for select to authenticated using (true);

-- Programmes
create policy "programmes_proprietaire" on programs
  for all using (auth.uid() = user_id);

-- Séances : accessibles via le programme parent
create policy "sessions_via_programme" on sessions
  for all using (
    exists (select 1 from programs p where p.id = sessions.program_id and p.user_id = auth.uid())
  );

create policy "blocs_via_session" on session_blocks
  for all using (
    exists (
      select 1 from sessions s
      join programs p on p.id = s.program_id
      where s.id = session_blocks.session_id and p.user_id = auth.uid()
    )
  );

-- Réalisé
create policy "workout_logs_proprietaire" on workout_logs
  for all using (auth.uid() = user_id);

create policy "set_logs_via_workout" on set_logs
  for all using (
    exists (select 1 from workout_logs w where w.id = set_logs.workout_log_id and w.user_id = auth.uid())
  );

create policy "cardio_logs_proprietaire" on cardio_logs
  for all using (auth.uid() = user_id);

create policy "records_proprietaire" on personal_records
  for all using (auth.uid() = user_id);

-- ============================================================
-- 9. TRIGGER : création automatique du profil à l'inscription
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Mise à jour automatique de updated_at
create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function handle_updated_at();

-- ============================================================
-- 10. SEED — CATALOGUE D'EXERCICES
-- ============================================================

insert into exercises (slug, nom, pattern, equipement_requis, muscles_primaires, zones_sollicitees, is_unilateral) values
-- Squat
('back-squat', 'Squat barre', 'squat', 'salle_complete', '{quadriceps,fessiers}', '{genou,dos_bas,hanche}', false),
('front-squat', 'Squat avant', 'squat', 'salle_complete', '{quadriceps,fessiers}', '{genou,poignet,epaule}', false),
('goblet-squat', 'Goblet squat', 'squat', 'halteres_seuls', '{quadriceps,fessiers}', '{genou}', false),
('leg-press', 'Presse à cuisses', 'squat', 'salle_complete', '{quadriceps,fessiers}', '{genou}', false),
('bulgarian-split-squat', 'Fente bulgare', 'lunge', 'halteres_seuls', '{quadriceps,fessiers}', '{genou,hanche}', true),
('air-squat', 'Squat au poids du corps', 'squat', 'poids_corps', '{quadriceps,fessiers}', '{genou}', false),

-- Hinge
('deadlift', 'Soulevé de terre', 'hinge', 'salle_complete', '{ischios,fessiers,dos}', '{dos_bas,hanche}', false),
('romanian-deadlift', 'Soulevé de terre roumain', 'hinge', 'salle_complete', '{ischios,fessiers}', '{dos_bas,hanche}', false),
('trap-bar-deadlift', 'Soulevé de terre trap bar', 'hinge', 'salle_complete', '{ischios,fessiers,quadriceps}', '{dos_bas}', false),
('hip-thrust', 'Hip thrust', 'hinge', 'salle_complete', '{fessiers}', '{hanche}', false),
('kettlebell-swing', 'Kettlebell swing', 'hinge', 'halteres_seuls', '{fessiers,ischios}', '{dos_bas,hanche}', false),
('back-extension', 'Extension lombaire', 'hinge', 'salle_complete', '{lombaires,fessiers}', '{dos_bas}', false),

-- Push horizontal
('bench-press', 'Développé couché', 'push_horizontal', 'salle_complete', '{pectoraux,triceps}', '{epaule,coude}', false),
('incline-bench-press', 'Développé incliné', 'push_horizontal', 'salle_complete', '{pectoraux,epaules}', '{epaule,coude}', false),
('dumbbell-bench-press', 'Développé couché haltères', 'push_horizontal', 'halteres_seuls', '{pectoraux,triceps}', '{epaule,coude}', false),
('push-up', 'Pompes', 'push_horizontal', 'poids_corps', '{pectoraux,triceps}', '{epaule,poignet,coude}', false),
('chest-press-machine', 'Développé machine', 'push_horizontal', 'salle_complete', '{pectoraux}', '{epaule}', false),
('cable-fly', 'Écarté poulie', 'isolation', 'salle_complete', '{pectoraux}', '{epaule}', false),

-- Push vertical
('overhead-press', 'Développé militaire', 'push_vertical', 'salle_complete', '{epaules,triceps}', '{epaule,coude,dos_bas}', false),
('dumbbell-shoulder-press', 'Développé épaules haltères', 'push_vertical', 'halteres_seuls', '{epaules,triceps}', '{epaule,coude}', false),
('landmine-press', 'Landmine press', 'push_vertical', 'salle_complete', '{epaules}', '{epaule}', true),
('lateral-raise', 'Élévations latérales', 'isolation', 'halteres_seuls', '{deltoides}', '{epaule}', false),

-- Pull horizontal
('barbell-row', 'Rowing barre', 'pull_horizontal', 'salle_complete', '{dos,biceps}', '{dos_bas,coude}', false),
('dumbbell-row', 'Rowing haltère', 'pull_horizontal', 'halteres_seuls', '{dos,biceps}', '{coude}', true),
('cable-row', 'Rowing poulie basse', 'pull_horizontal', 'salle_complete', '{dos,biceps}', '{coude}', false),
('chest-supported-row', 'Rowing buste soutenu', 'pull_horizontal', 'salle_complete', '{dos}', '{coude}', false),
('inverted-row', 'Rowing australien', 'pull_horizontal', 'poids_corps', '{dos,biceps}', '{coude}', false),

-- Pull vertical
('pull-up', 'Tractions', 'pull_vertical', 'poids_corps', '{dos,biceps}', '{epaule,coude}', false),
('lat-pulldown', 'Tirage vertical', 'pull_vertical', 'salle_complete', '{dos,biceps}', '{epaule,coude}', false),
('assisted-pull-up', 'Tractions assistées', 'pull_vertical', 'salle_complete', '{dos,biceps}', '{epaule,coude}', false),

-- Bras
('barbell-curl', 'Curl barre', 'isolation', 'salle_complete', '{biceps}', '{coude,poignet}', false),
('hammer-curl', 'Curl marteau', 'isolation', 'halteres_seuls', '{biceps,brachial}', '{coude}', false),
('triceps-pushdown', 'Extension triceps poulie', 'isolation', 'salle_complete', '{triceps}', '{coude}', false),
('overhead-triceps-extension', 'Extension triceps nuque', 'isolation', 'halteres_seuls', '{triceps}', '{coude,epaule}', false),
('dips', 'Dips', 'push_horizontal', 'poids_corps', '{triceps,pectoraux}', '{epaule,coude}', false),
('close-grip-bench', 'Développé couché prise serrée', 'push_horizontal', 'salle_complete', '{triceps,pectoraux}', '{coude,epaule}', false),

-- Carry & core (spécifique Hyrox)
('farmers-carry', 'Farmer''s carry', 'carry', 'halteres_seuls', '{avant_bras,trapezes,core}', '{poignet,dos_bas}', false),
('sled-push', 'Poussée de traîneau', 'carry', 'salle_complete', '{quadriceps,fessiers}', '{genou}', false),
('sled-pull', 'Tirage de traîneau', 'carry', 'salle_complete', '{dos,fessiers}', '{dos_bas}', false),
('sandbag-lunge', 'Fente sandbag', 'lunge', 'salle_complete', '{quadriceps,fessiers}', '{genou,dos_bas}', false),
('wall-ball', 'Wall ball', 'squat', 'salle_complete', '{quadriceps,epaules}', '{genou,epaule}', false),
('burpee-broad-jump', 'Burpee broad jump', 'core', 'poids_corps', '{full_body}', '{genou,poignet,epaule}', false),
('plank', 'Gainage', 'core', 'poids_corps', '{core}', '{epaule,dos_bas}', false),
('hanging-leg-raise', 'Relevé de jambes suspendu', 'core', 'poids_corps', '{core}', '{epaule}', false),
('ab-wheel', 'Roue abdominale', 'core', 'halteres_seuls', '{core}', '{dos_bas,epaule}', false),

-- Mollets
('standing-calf-raise', 'Extension mollets debout', 'isolation', 'salle_complete', '{mollets}', '{cheville}', false),
('seated-calf-raise', 'Extension mollets assis', 'isolation', 'salle_complete', '{mollets}', '{cheville}', false);

-- ============================================================
-- 11. SEED — SUBSTITUTIONS
-- ============================================================

-- Substitutions pour limitation ÉPAULE
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_epaule', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('bench-press', 'chest-press-machine'),
  ('overhead-press', 'landmine-press'),
  ('incline-bench-press', 'chest-press-machine'),
  ('pull-up', 'lat-pulldown'),
  ('dips', 'triceps-pushdown'),
  ('push-up', 'chest-press-machine')
);

-- Substitutions pour limitation COUDE (tendinopathie, épicondylite)
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_coude', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('close-grip-bench', 'chest-press-machine'),
  ('overhead-triceps-extension', 'triceps-pushdown'),
  ('dips', 'chest-press-machine'),
  ('barbell-curl', 'hammer-curl'),
  ('barbell-row', 'chest-supported-row')
);

-- Substitutions pour limitation DOS BAS
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_dos_bas', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('deadlift', 'hip-thrust'),
  ('barbell-row', 'chest-supported-row'),
  ('back-squat', 'leg-press'),
  ('overhead-press', 'dumbbell-shoulder-press'),
  ('romanian-deadlift', 'back-extension')
);

-- Substitutions pour limitation GENOU
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'limitation_genou', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('back-squat', 'leg-press'),
  ('bulgarian-split-squat', 'hip-thrust'),
  ('wall-ball', 'kettlebell-swing'),
  ('burpee-broad-jump', 'plank'),
  ('sandbag-lunge', 'romanian-deadlift')
);

-- Substitutions pour ÉQUIPEMENT ABSENT (home gym / haltères seuls)
insert into exercise_substitutions (exercise_id, substitut_id, raison, priorite)
select e.id, s.id, 'equipement_absent', 1
from exercises e, exercises s
where (e.slug, s.slug) in (
  ('back-squat', 'goblet-squat'),
  ('bench-press', 'dumbbell-bench-press'),
  ('barbell-row', 'dumbbell-row'),
  ('lat-pulldown', 'pull-up'),
  ('cable-row', 'dumbbell-row'),
  ('leg-press', 'bulgarian-split-squat'),
  ('triceps-pushdown', 'overhead-triceps-extension'),
  ('deadlift', 'kettlebell-swing')
);