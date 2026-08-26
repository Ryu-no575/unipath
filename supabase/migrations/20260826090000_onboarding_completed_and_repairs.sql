-- Fixes the onboarding redirect loop.
--
-- Root cause: `profiles` rows are supposed to be auto-created by the
-- `handle_new_user` trigger (see 20260825120000_core_schema.sql) when a user
-- signs up, and onboarding-completion was tracked only via the nullable
-- `onboarding_completed_at` column. Any user whose `profiles` row didn't
-- exist (trigger not applied yet / created before the trigger existed) had
-- every `UPDATE ... WHERE user_id = ...` silently affect 0 rows (Postgres/
-- PostgREST does not error on that), so onboarding could never be marked
-- complete and the user was bounced back to /onboarding forever.
--
-- This migration is non-destructive: it only adds a column, backfills it,
-- creates any missing `profiles` rows for existing auth.users, and
-- (re)asserts the trigger/constraints/policies this relies on. No data is
-- dropped or overwritten.

-- ---------------------------------------------------------------------------
-- 1. Explicit completion flag
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Backfill from the existing timestamp so already-completed users aren't
-- sent back through onboarding.
update public.profiles
set onboarding_completed = true
where onboarding_completed_at is not null
  and onboarding_completed = false;

-- ---------------------------------------------------------------------------
-- 2. Repair any users missing a profiles row (the actual cause of the loop)
-- ---------------------------------------------------------------------------

insert into public.profiles (user_id)
select u.id
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

-- ---------------------------------------------------------------------------
-- 3. Re-assert the one-profile-per-user constraint (idempotent)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'u'
      and conkey = (
        select array_agg(attnum order by attnum)
        from pg_attribute
        where attrelid = 'public.profiles'::regclass
          and attname = 'user_id'
      )
  ) then
    alter table public.profiles add constraint profiles_user_id_key unique (user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Re-assert the auto-provisioning trigger (idempotent; in case it was
--    never applied to the live database)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. Re-assert RLS policies (idempotent; in case the earlier migration was
--    only partially applied)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_destination_preferences enable row level security;
alter table public.profile_priorities enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

drop policy if exists "profile_destination_preferences_select_own" on public.profile_destination_preferences;
create policy "profile_destination_preferences_select_own"
  on public.profile_destination_preferences
  for select using (auth.uid() = user_id);
drop policy if exists "profile_destination_preferences_insert_own" on public.profile_destination_preferences;
create policy "profile_destination_preferences_insert_own"
  on public.profile_destination_preferences
  for insert with check (auth.uid() = user_id);
drop policy if exists "profile_destination_preferences_update_own" on public.profile_destination_preferences;
create policy "profile_destination_preferences_update_own"
  on public.profile_destination_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "profile_destination_preferences_delete_own" on public.profile_destination_preferences;
create policy "profile_destination_preferences_delete_own"
  on public.profile_destination_preferences
  for delete using (auth.uid() = user_id);

drop policy if exists "profile_priorities_select_own" on public.profile_priorities;
create policy "profile_priorities_select_own" on public.profile_priorities
  for select using (auth.uid() = user_id);
drop policy if exists "profile_priorities_insert_own" on public.profile_priorities;
create policy "profile_priorities_insert_own" on public.profile_priorities
  for insert with check (auth.uid() = user_id);
drop policy if exists "profile_priorities_update_own" on public.profile_priorities;
create policy "profile_priorities_update_own" on public.profile_priorities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "profile_priorities_delete_own" on public.profile_priorities;
create policy "profile_priorities_delete_own" on public.profile_priorities
  for delete using (auth.uid() = user_id);
