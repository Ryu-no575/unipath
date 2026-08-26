-- UniPath core schema: global student profile + future-proofed university /
-- program / admission / application / task structure.
--
-- Run this in the Supabase SQL Editor (or `supabase db push` if you use the
-- CLI) before 20260825120100_row_level_security.sql.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.application_type as enum (
  'bachelor', 'master', 'phd', 'exchange', 'transfer'
);

create type public.intake_season as enum (
  'spring', 'summer', 'fall', 'winter', 'flexible'
);

create type public.english_test_type as enum (
  'ielts', 'toefl', 'duolingo', 'cambridge', 'none', 'other'
);

create type public.priority_type as enum (
  'tuition', 'academic_quality', 'ranking', 'employment', 'location',
  'safety', 'international_community', 'cost_of_living', 'research',
  'campus_life'
);

create type public.application_status as enum (
  'considering', 'preparing', 'applied', 'interview', 'accepted',
  'rejected', 'withdrawn'
);

create type public.task_type as enum (
  'application', 'document', 'test', 'recommendation', 'scholarship',
  'interview', 'payment', 'visa', 'housing', 'travel', 'enrollment', 'other'
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Global Student Profile
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,

  -- Personal
  nationality text,
  residence_country text,
  preferred_locale text,

  -- Study Goal
  application_type public.application_type,
  intake_year integer,
  intake_season public.intake_season,
  field_of_study text,

  -- Academic Profile
  education_level text,
  previous_institution text,
  gpa_value numeric(5, 3),
  gpa_scale numeric(5, 3),

  -- Language
  english_test_type public.english_test_type,
  english_test_score text,

  -- Budget
  max_tuition numeric(12, 2),
  tuition_currency text,
  max_living_cost numeric(12, 2),
  living_cost_currency text,

  -- Set once the Onboarding wizard is completed; null means the user still
  -- needs to see /onboarding. Not in the original spec's field list, but
  -- required to know when to route a logged-in user to onboarding vs.
  -- dashboard.
  onboarding_completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_user_id_idx on public.profiles (user_id);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets an (empty) profile row immediately, so the rest
-- of the app can always assume `profiles` has exactly one row per user
-- instead of having to handle "no profile yet" as a separate case.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Destination Preferences (many countries per user)

create table public.profile_destination_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  country_code text not null,
  created_at timestamptz not null default now(),
  unique (user_id, country_code)
);

create index profile_destination_preferences_user_id_idx
  on public.profile_destination_preferences (user_id);

-- Priorities (weighted)

create table public.profile_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  priority_type public.priority_type not null,
  weight smallint not null check (weight between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, priority_type)
);

create index profile_priorities_user_id_idx on public.profile_priorities (user_id);

create trigger set_profile_priorities_updated_at
  before update on public.profile_priorities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Public catalog: universities / programs / admission cycles / requirements
-- ---------------------------------------------------------------------------

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  ror_id text unique,
  official_name text not null,
  country_code text,
  city text,
  official_website text,
  founded_year integer,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_universities_updated_at
  before update on public.universities
  for each row execute function public.set_updated_at();

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  official_name text not null,
  degree_type text,
  field text,
  language text,
  duration text,
  official_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index programs_university_id_idx on public.programs (university_id);

create trigger set_programs_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

create table public.admission_cycles (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  intake_year integer not null,
  intake_season public.intake_season not null,
  application_open_date date,
  application_deadline timestamptz,
  deadline_timezone text,
  application_fee numeric(10, 2),
  application_fee_currency text,
  tuition numeric(12, 2),
  tuition_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admission_cycles_program_id_idx on public.admission_cycles (program_id);
create index admission_cycles_deadline_idx on public.admission_cycles (application_deadline);

create trigger set_admission_cycles_updated_at
  before update on public.admission_cycles
  for each row execute function public.set_updated_at();

-- Sources (created before admission_requirements, which references it)

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  official_url text,
  title text,
  publisher text,
  retrieved_at timestamptz,
  verified_at timestamptz,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now()
);

create table public.admission_requirements (
  id uuid primary key default gen_random_uuid(),
  admission_cycle_id uuid not null references public.admission_cycles (id) on delete cascade,
  requirement_type text not null,
  title text not null,
  description text,
  required boolean not null default true,
  minimum_value text,
  source_id uuid references public.sources (id) on delete set null,
  created_at timestamptz not null default now()
);

create index admission_requirements_cycle_id_idx
  on public.admission_requirements (admission_cycle_id);

-- ---------------------------------------------------------------------------
-- User applications + tasks
-- ---------------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete restrict,
  admission_cycle_id uuid references public.admission_cycles (id) on delete set null,
  status public.application_status not null default 'considering',
  progress smallint not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_user_id_idx on public.applications (user_id);
create index applications_program_id_idx on public.applications (program_id);

create trigger set_applications_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  title text not null,
  description text,
  task_type public.task_type not null default 'other',
  -- Absolute instant in time (UTC-normalized) plus the timezone it was
  -- authored in, so the calendar can render "this is 9am local for the
  -- user" instead of losing that context — every user is in a different
  -- timezone, so both fields are required for anything date-like.
  due_at timestamptz,
  timezone text not null default 'UTC',
  completed boolean not null default false,
  priority smallint not null default 2 check (priority between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_application_id_idx on public.tasks (application_id);
create index tasks_due_at_idx on public.tasks (due_at);

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();
