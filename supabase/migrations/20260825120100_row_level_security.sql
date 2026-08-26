-- Row Level Security policies.
--
-- Two access patterns:
--   1. Personal data (profiles, profile_destination_preferences,
--      profile_priorities, applications, tasks): each authenticated user can
--      only see/change their own rows (auth.uid() = user_id).
--   2. Public catalog data (universities, programs, admission_cycles,
--      admission_requirements, sources): readable by anyone (including
--      signed-out visitors browsing Explore), writable only by the service
--      role (no insert/update/delete policy is defined for anon/authenticated,
--      and the service role bypasses RLS entirely).

-- ---------------------------------------------------------------------------
-- Personal data
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

alter table public.profile_destination_preferences enable row level security;

create policy "profile_destination_preferences_select_own"
  on public.profile_destination_preferences
  for select using (auth.uid() = user_id);
create policy "profile_destination_preferences_insert_own"
  on public.profile_destination_preferences
  for insert with check (auth.uid() = user_id);
create policy "profile_destination_preferences_update_own"
  on public.profile_destination_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profile_destination_preferences_delete_own"
  on public.profile_destination_preferences
  for delete using (auth.uid() = user_id);

alter table public.profile_priorities enable row level security;

create policy "profile_priorities_select_own" on public.profile_priorities
  for select using (auth.uid() = user_id);
create policy "profile_priorities_insert_own" on public.profile_priorities
  for insert with check (auth.uid() = user_id);
create policy "profile_priorities_update_own" on public.profile_priorities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profile_priorities_delete_own" on public.profile_priorities
  for delete using (auth.uid() = user_id);

alter table public.applications enable row level security;

create policy "applications_select_own" on public.applications
  for select using (auth.uid() = user_id);
create policy "applications_insert_own" on public.applications
  for insert with check (auth.uid() = user_id);
create policy "applications_update_own" on public.applications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "applications_delete_own" on public.applications
  for delete using (auth.uid() = user_id);

alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Public catalog data — read-only for anon + authenticated
-- ---------------------------------------------------------------------------

alter table public.universities enable row level security;
create policy "universities_public_read" on public.universities
  for select using (true);

alter table public.programs enable row level security;
create policy "programs_public_read" on public.programs
  for select using (true);

alter table public.admission_cycles enable row level security;
create policy "admission_cycles_public_read" on public.admission_cycles
  for select using (true);

alter table public.admission_requirements enable row level security;
create policy "admission_requirements_public_read" on public.admission_requirements
  for select using (true);

alter table public.sources enable row level security;
create policy "sources_public_read" on public.sources
  for select using (true);
