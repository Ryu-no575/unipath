-- Route Decision Engine v2 -- weekly study capacity
--
-- Adds one nullable column so the Capacity Check (Routes -> "Hours available
-- per week", see app/lib/routes/capacityCheck.ts) can compare a route's own
-- estimated preparation workload (app/lib/routes/workloadEstimator.ts)
-- against how much time the user actually says they have. Optional by
-- design: null means "not set" and every capacity-aware component renders
-- an "Unknown" state rather than assuming a number (see AGENTS.md task
-- notes: never fabricate a value the user hasn't provided).
--
-- Entirely additive: no table, row, or existing column is dropped, no data
-- is deleted, and RLS is left exactly as it already is on `profiles` (this
-- migration only adds a column + a check constraint). Safe to paste into
-- the Supabase SQL Editor and run once. Do NOT apply automatically.

alter table public.profiles
  add column if not exists weekly_study_hours_available integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_weekly_study_hours_available_check'
  ) then
    alter table public.profiles
      add constraint profiles_weekly_study_hours_available_check
      check (weekly_study_hours_available is null or (weekly_study_hours_available >= 0 and weekly_study_hours_available <= 168));
  end if;
end $$;
