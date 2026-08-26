-- Watch subscription hardening + admission-cycle-aware tracking.
--
-- Fixes/hardens on top of 20260826210000_verified_live_data_system.sql and
-- 20260826220000_watch_subscriptions_user_writes.sql:
--   1. Re-affirms applications_create_watch_subscription() with a single
--      `v_university_id` declaration (defensive re-assert; the checked-in
--      version of 20260826210000 already declares it once).
--   2. Re-affirms notifications exists with the required shape (no-op if
--      already created by 20260826210000).
--   3. Re-affirms change_events RLS: enabled, public SELECT only, no
--      insert/update/delete policy for anon/authenticated (service-role only).
--   4. Tightens source_snapshots: drops the public SELECT policy. Nothing in
--      the app reads source_snapshots through the browser/session client --
--      app/lib/live-data/checkSource.ts and simulate.ts both write via the
--      service-role admin client, which bypasses RLS entirely -- and users
--      should only ever see change_events (old_value/new_value), never the
--      raw snapshot. RLS stays enabled with zero anon/authenticated policies.
--   5. NEW: when an application's program_id/admission_cycle_id changes,
--      prunes the now-orphaned watch_subscriptions row for the OLD
--      program/cycle, unless the same user still references it from another
--      application.
--   6. NEW: watch_subscriptions can now track distinct admission cycles of
--      the same program independently (e.g. "Architecture 2027" vs
--      "Architecture 2028"). Uniqueness is keyed on (user_id,
--      admission_cycle_id) when a cycle is known, falling back to
--      (user_id, program_id) only when it isn't.
--   7. No DB trigger added for change_event -> notification fan-out: that is
--      already implemented server-side in app/lib/live-data/notify.ts
--      (fanOutNotificationsForChangeEvent), which uses the service-role
--      client -- adding a DB trigger would double-send notifications.
--   8. set_updated_at() is only created if missing; it already exists from
--      20260825120000_core_schema.sql.
--
-- Entirely additive/non-destructive: no table, row, or existing column is
-- dropped or truncated. auth.users, profiles, applications, tasks,
-- universities, programs, admission_cycles are untouched. Safe to paste into
-- the Supabase SQL Editor and run once, and safe to re-run.

-- ---------------------------------------------------------------------------
-- 0. set_updated_at() -- create only if it doesn't already exist
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    create function public.set_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. notifications -- re-affirm shape + RLS (no-op if already correct)
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  change_event_id uuid references public.change_events (id) on delete cascade,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where not read;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

-- Marking as read is the only client-side write; creation is service-role
-- only (see app/lib/live-data/notify.ts), so there is no insert/delete
-- policy for anon/authenticated.
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. change_events -- re-affirm RLS: public read, no user writes
-- ---------------------------------------------------------------------------

alter table public.change_events enable row level security;

drop policy if exists "change_events_public_read" on public.change_events;
create policy "change_events_public_read" on public.change_events
  for select using (true);
-- Deliberately no insert/update/delete policy for anon/authenticated: Live
-- Data is only ever written by the service-role crawler/review pipeline.

-- ---------------------------------------------------------------------------
-- 3. source_snapshots -- tighten: remove the public SELECT policy
-- ---------------------------------------------------------------------------

alter table public.source_snapshots enable row level security;

drop policy if exists "source_snapshots_public_read" on public.source_snapshots;
-- No replacement policy: RLS stays enabled with zero anon/authenticated
-- policies, so only the service role can read or write source_snapshots.
-- User-facing screens should surface change_events (old_value/new_value)
-- instead of the raw snapshot.

-- ---------------------------------------------------------------------------
-- 4. watch_subscriptions -- admission-cycle-aware uniqueness
-- ---------------------------------------------------------------------------

-- Safe to drop: every existing row is still covered by exactly one of the
-- two indexes created below (a program-only unique index could only ever
-- produce one row per (user_id, program_id), so there is nothing to dedupe).
drop index if exists public.watch_subscriptions_user_program_key;

create unique index if not exists watch_subscriptions_user_cycle_key
  on public.watch_subscriptions (user_id, admission_cycle_id)
  where admission_cycle_id is not null;

create unique index if not exists watch_subscriptions_user_program_no_cycle_key
  on public.watch_subscriptions (user_id, program_id)
  where program_id is not null and admission_cycle_id is null;

-- ---------------------------------------------------------------------------
-- 5. Upsert: prefer the admission_cycle_id key when known, else program_id
-- ---------------------------------------------------------------------------

create or replace function public.applications_create_watch_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_university_id uuid;
begin
  if new.program_id is null then
    return new;
  end if;

  select university_id into v_university_id
    from public.programs where id = new.program_id;

  if new.admission_cycle_id is not null then
    insert into public.watch_subscriptions (user_id, university_id, program_id, admission_cycle_id, enabled)
    values (new.user_id, v_university_id, new.program_id, new.admission_cycle_id, true)
    on conflict (user_id, admission_cycle_id) where admission_cycle_id is not null
    do update set
      program_id = excluded.program_id,
      university_id = excluded.university_id;
      -- Deliberately does not touch `enabled` -- an application update must
      -- never silently undo a user's manual mute.
  else
    insert into public.watch_subscriptions (user_id, university_id, program_id, admission_cycle_id, enabled)
    values (new.user_id, v_university_id, new.program_id, null, true)
    on conflict (user_id, program_id) where program_id is not null and admission_cycle_id is null
    do update set
      university_id = excluded.university_id;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_insert_watch_subscription on public.applications;
create trigger applications_insert_watch_subscription
  after insert on public.applications
  for each row execute function public.applications_create_watch_subscription();

drop trigger if exists applications_update_watch_subscription on public.applications;
create trigger applications_update_watch_subscription
  after update of program_id, admission_cycle_id on public.applications
  for each row execute function public.applications_create_watch_subscription();

-- ---------------------------------------------------------------------------
-- 6. Shared prune helper: delete a watch_subscriptions row only if no other
--    application by the same user still needs it
-- ---------------------------------------------------------------------------

create or replace function public.watch_subscriptions_prune_if_orphaned(
  p_user_id uuid,
  p_program_id uuid,
  p_admission_cycle_id uuid,
  p_exclude_application_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_program_id is null then
    return;
  end if;

  if p_admission_cycle_id is not null then
    if exists (
      select 1 from public.applications
      where user_id = p_user_id
        and admission_cycle_id = p_admission_cycle_id
        and id is distinct from p_exclude_application_id
    ) then
      return;
    end if;

    delete from public.watch_subscriptions
      where user_id = p_user_id and admission_cycle_id = p_admission_cycle_id;
  else
    if exists (
      select 1 from public.applications
      where user_id = p_user_id
        and program_id = p_program_id
        and admission_cycle_id is null
        and id is distinct from p_exclude_application_id
    ) then
      return;
    end if;

    delete from public.watch_subscriptions
      where user_id = p_user_id and program_id = p_program_id and admission_cycle_id is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. NEW: prune the OLD watch on UPDATE when program_id/admission_cycle_id
--    changes (e.g. an application is repointed from program A to program B)
-- ---------------------------------------------------------------------------

create or replace function public.applications_prune_stale_watch_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.program_id is null then
    return new;
  end if;

  if new.program_id is not distinct from old.program_id
     and new.admission_cycle_id is not distinct from old.admission_cycle_id then
    return new;
  end if;

  perform public.watch_subscriptions_prune_if_orphaned(
    old.user_id, old.program_id, old.admission_cycle_id, new.id
  );

  return new;
end;
$$;

drop trigger if exists applications_prune_stale_watch_subscription on public.applications;
create trigger applications_prune_stale_watch_subscription
  after update of program_id, admission_cycle_id on public.applications
  for each row execute function public.applications_prune_stale_watch_subscription();

-- ---------------------------------------------------------------------------
-- 8. Prune on DELETE -- now routed through the same shared helper so cycle-
--    scoped and program-scoped watches are both handled correctly
-- ---------------------------------------------------------------------------

create or replace function public.applications_prune_watch_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.watch_subscriptions_prune_if_orphaned(
    old.user_id, old.program_id, old.admission_cycle_id, old.id
  );
  return old;
end;
$$;

drop trigger if exists applications_delete_watch_subscription on public.applications;
create trigger applications_delete_watch_subscription
  after delete on public.applications
  for each row execute function public.applications_prune_watch_subscription();
