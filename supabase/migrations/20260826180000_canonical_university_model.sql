-- Canonical university database: lock public.universities down to
-- effectively read-only for normal users, and give users a private place to
-- add a university that isn't in the shared catalog yet without polluting
-- it.
--
-- Root cause of "new row violates row-level security policy for table
-- universities": app/lib/actions/applications.ts inserted directly into
-- public.universities whenever a typed university name didn't match an
-- existing catalog row. 20260825120100_row_level_security.sql intentionally
-- only grants public SELECT on universities (no insert policy for anon/
-- authenticated), so every "this university isn't in the catalog yet"
-- attempt failed with that RLS error.
--
-- 20260826150000_journey_v1.sql later tried to paper over this by adding an
-- unrestricted `for insert to authenticated with check (true)` policy on
-- universities. That is exactly the design we do NOT want long-term (a
-- shared, canonical university list that any signed-in user can freely
-- insert into, inviting spam/duplicates) -- this migration removes that
-- policy (a no-op if it was never applied) and replaces the pattern with a
-- per-user user_custom_universities table plus a nullable
-- applications.custom_university_id.
--
-- Non-destructive: no table is dropped or truncated, RLS stays enabled
-- everywhere it already was, and every new applications column is nullable
-- so existing rows (which all use the official catalog path today) keep
-- working unchanged.

-- ---------------------------------------------------------------------------
-- 1. Remove the unrestricted "any signed-in user can insert a university"
--    policy. universities INSERT/UPDATE/DELETE from the client is
--    unsupported by design -- rows are meant to be added by ROR/OpenAlex
--    import jobs or admin review, both of which use the service role and
--    bypass RLS entirely. (universities_public_read from
--    20260825120100_row_level_security.sql is untouched: SELECT stays open
--    to everyone, including signed-out visitors.)
-- ---------------------------------------------------------------------------

drop policy if exists "universities_insert_authenticated" on public.universities;

-- ---------------------------------------------------------------------------
-- 2. user_custom_universities: a user's own private "this university isn't
--    in UniPath's catalog yet" entry. Never merged into public.universities
--    automatically -- promoting a custom entry into the shared catalog stays
--    a curated/admin process.
-- ---------------------------------------------------------------------------

create table if not exists public.user_custom_universities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  university_name text not null,
  country_code text,
  city text,
  official_website text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_custom_universities_user_id_idx
  on public.user_custom_universities (user_id);

drop trigger if exists set_user_custom_universities_updated_at on public.user_custom_universities;
create trigger set_user_custom_universities_updated_at
  before update on public.user_custom_universities
  for each row execute function public.set_updated_at();

alter table public.user_custom_universities enable row level security;

drop policy if exists "user_custom_universities_select_own" on public.user_custom_universities;
create policy "user_custom_universities_select_own" on public.user_custom_universities
  for select using (auth.uid() = user_id);
drop policy if exists "user_custom_universities_insert_own" on public.user_custom_universities;
create policy "user_custom_universities_insert_own" on public.user_custom_universities
  for insert with check (auth.uid() = user_id);
drop policy if exists "user_custom_universities_update_own" on public.user_custom_universities;
create policy "user_custom_universities_update_own" on public.user_custom_universities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_custom_universities_delete_own" on public.user_custom_universities;
create policy "user_custom_universities_delete_own" on public.user_custom_universities
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. applications: support either the official catalog path
--    (program_id -> programs -> universities) or a private custom-university
--    path (custom_university_id + free-text program/intake fields), never
--    both at once. program_id becomes nullable to allow the second path;
--    every existing row already has program_id set and custom_university_id
--    null, so the new check constraint holds for all current data.
-- ---------------------------------------------------------------------------

alter table public.applications
  alter column program_id drop not null;

alter table public.applications
  add column if not exists custom_university_id uuid
    references public.user_custom_universities (id) on delete restrict,
  add column if not exists custom_program_name text,
  add column if not exists custom_degree_type text,
  add column if not exists custom_field text,
  add column if not exists custom_intake_year integer,
  add column if not exists custom_intake_season public.intake_season,
  add column if not exists custom_application_deadline timestamptz,
  add column if not exists custom_deadline_timezone text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'applications_official_or_custom_university'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_official_or_custom_university check (
        (program_id is not null and custom_university_id is null)
        or
        (program_id is null and custom_university_id is not null and custom_program_name is not null)
      );
  end if;
end $$;

create index if not exists applications_custom_university_id_idx
  on public.applications (custom_university_id);
