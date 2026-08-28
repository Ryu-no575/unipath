-- Route Engine v1 -- active route selection
--
-- Adds a single column so "Use this route" (Routes -> RouteCard/RouteDetail,
-- see app/lib/actions/routes.ts) persists which of the 5 policy-driven
-- routes (fastest/safest/budget/ambitious/balanced) a user has chosen, so
-- Dashboard, Plan, Calendar, and Next Action all agree on it across
-- requests (see app/lib/routes/activeRoute.ts). Nothing else about the
-- Route Engine needs a schema change: every Route (steps, dates, gap
-- analysis, feasibility) is computed on every request from data that
-- already exists, and Route-suggested Calendar entries are synthetic --
-- never written to `tasks` (see app/lib/routes/routeCalendarSync.ts).
--
-- Entirely additive: no table, row, or existing column is dropped, no data
-- is deleted, and RLS is left exactly as it already is on `profiles` (this
-- migration only adds a column + a check constraint). Safe to paste into
-- the Supabase SQL Editor and run once. Do NOT apply automatically.

alter table public.profiles
  add column if not exists active_route_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_active_route_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_active_route_type_check
      check (active_route_type is null or active_route_type in ('fastest', 'safest', 'budget', 'ambitious', 'balanced'));
  end if;
end $$;
