-- Match Quiz preferences: the handful of questions the Match Quiz asks that
-- aren't already captured by public.profiles / profile_destination_preferences
-- / profile_priorities (destination countries, field of study, degree type,
-- budget, and the 10 weighted priorities all already exist -- this table only
-- adds what the quiz asks *in addition* to that).
--
-- Not required for the Match Quiz -> Results flow to work today: quiz answers
-- travel to the results page via the URL, and the app writes here on a
-- best-effort basis (app/lib/actions/match.ts swallows the write error) so
-- the feature keeps working before this migration has been applied, and
-- persistence (e.g. a future "resume your last match" entry point) starts
-- working automatically once it has.

create type public.campus_environment as enum (
  'urban', 'suburban', 'rural', 'no_preference'
);

create type public.class_size_preference as enum (
  'small', 'medium', 'large', 'no_preference'
);

create type public.climate_preference as enum (
  'warm', 'moderate', 'cold', 'no_preference'
);

create table public.match_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,

  campus_environment public.campus_environment not null default 'no_preference',
  class_size_preference public.class_size_preference not null default 'no_preference',
  climate_preference public.climate_preference not null default 'no_preference',
  work_while_studying_importance smallint not null default 3
    check (work_while_studying_importance between 1 and 5),
  scholarship_need boolean not null default false,

  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index match_preferences_user_id_idx on public.match_preferences (user_id);

create trigger set_match_preferences_updated_at
  before update on public.match_preferences
  for each row execute function public.set_updated_at();

alter table public.match_preferences enable row level security;

create policy "match_preferences_select_own" on public.match_preferences
  for select using (auth.uid() = user_id);
create policy "match_preferences_insert_own" on public.match_preferences
  for insert with check (auth.uid() = user_id);
create policy "match_preferences_update_own" on public.match_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "match_preferences_delete_own" on public.match_preferences
  for delete using (auth.uid() = user_id);
