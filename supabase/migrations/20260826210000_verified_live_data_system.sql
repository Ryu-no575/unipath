-- UniPath Verified Live Data System v1: foundation for "confirm official
-- university sources on an ongoing basis, detect when they change, and
-- notify affected users" -- schema only in this migration. The actual
-- scheduled crawler is a later phase; this lays the tables + relationships
-- checkSource(sourceId) (app/lib/live-data/checkSource.ts) and the
-- Notifications / Latest Updates UI need to exist and be demoable today.
--
-- Entirely additive/non-destructive: no table is dropped, altered
-- destructively, or truncated. Every new column is nullable or has a safe
-- default, so all existing rows (and the empty `sources` table today) keep
-- working unchanged.

-- ---------------------------------------------------------------------------
-- 1. Extend `sources`: what kind of official page it is, monitoring
--    timestamps, and which catalog entity it documents (a source can be
--    about a university's homepage, a specific program page, or a specific
--    admission cycle's deadline/tuition page -- at most it's about one of
--    the three, enforced below).
-- ---------------------------------------------------------------------------

alter table public.sources
  add column if not exists page_type text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_successful_check_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists university_id uuid references public.universities (id) on delete cascade,
  add column if not exists program_id uuid references public.programs (id) on delete cascade,
  add column if not exists admission_cycle_id uuid references public.admission_cycles (id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sources_page_type_check'
      and conrelid = 'public.sources'::regclass
  ) then
    alter table public.sources
      add constraint sources_page_type_check check (
        page_type is null or page_type in (
          'university', 'program', 'admissions', 'deadline', 'tuition',
          'language_requirement', 'scholarship', 'visa', 'other'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sources_single_entity_link'
      and conrelid = 'public.sources'::regclass
  ) then
    alter table public.sources
      add constraint sources_single_entity_link check (
        (case when university_id is not null then 1 else 0 end) +
        (case when program_id is not null then 1 else 0 end) +
        (case when admission_cycle_id is not null then 1 else 0 end) <= 1
      );
  end if;
end $$;

create index if not exists sources_university_id_idx on public.sources (university_id);
create index if not exists sources_program_id_idx on public.sources (program_id);
create index if not exists sources_admission_cycle_id_idx on public.sources (admission_cycle_id);

drop trigger if exists set_sources_updated_at on public.sources;
create trigger set_sources_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. source_snapshots -- structured facts + a content hash captured each
--    time a source is checked, not the raw page. Only the latest few
--    snapshots per source are ever queried by the app; older ones are kept
--    for history but nothing here stores unbounded raw HTML.
-- ---------------------------------------------------------------------------

create table if not exists public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  content_hash text not null,
  extracted_data jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists source_snapshots_source_id_idx
  on public.source_snapshots (source_id, retrieved_at desc);

alter table public.source_snapshots enable row level security;

drop policy if exists "source_snapshots_public_read" on public.source_snapshots;
create policy "source_snapshots_public_read" on public.source_snapshots
  for select using (true);

-- ---------------------------------------------------------------------------
-- 3. change_events -- one row per field that changed between two snapshots
--    (or was newly detected). entity_type/entity_id point at the catalog row
--    the change is about, independent of which source detected it.
-- ---------------------------------------------------------------------------

create table if not exists public.change_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources (id) on delete set null,
  entity_type text not null check (entity_type in ('university', 'program', 'admission_cycle')),
  entity_id uuid not null,
  field_name text not null,
  old_value text,
  new_value text,
  change_type text not null default 'value_changed'
    check (change_type in ('value_changed', 'added', 'removed')),
  importance text not null check (importance in ('critical', 'important', 'minor')),
  detected_at timestamptz not null default now(),
  -- Safe update policy: detected -> pending_review -> approved -> applied
  -- (writes the new value into universities/programs/admission_cycles) is
  -- the only path that changes live catalog data from a detected change.
  -- 'rejected' lets a reviewer discard a false positive without deleting the
  -- audit row.
  review_status text not null default 'detected'
    check (review_status in ('detected', 'pending_review', 'approved', 'applied', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists change_events_entity_idx
  on public.change_events (entity_type, entity_id, detected_at desc);
create index if not exists change_events_source_id_idx on public.change_events (source_id);
create index if not exists change_events_review_status_idx on public.change_events (review_status);

alter table public.change_events enable row level security;

drop policy if exists "change_events_public_read" on public.change_events;
create policy "change_events_public_read" on public.change_events
  for select using (true);

-- ---------------------------------------------------------------------------
-- 4. notifications -- per-user, generated by fanning a change_event out to
--    every enabled watch_subscription that matches its entity.
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
-- 5. watch_subscriptions -- derived from `applications` (a "considering"
--    application already means "saved"; any other status already means
--    "applying"), kept in sync by triggers below so the app never has to
--    write to both tables. Custom (non-catalog) universities have no
--    program_id to watch, so they never get a row here -- there is no
--    official source to monitor for them anyway.
-- ---------------------------------------------------------------------------

create table if not exists public.watch_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  university_id uuid references public.universities (id) on delete cascade,
  program_id uuid references public.programs (id) on delete cascade,
  admission_cycle_id uuid references public.admission_cycles (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists watch_subscriptions_user_program_key
  on public.watch_subscriptions (user_id, program_id)
  where program_id is not null;

create index if not exists watch_subscriptions_program_id_idx
  on public.watch_subscriptions (program_id) where enabled;
create index if not exists watch_subscriptions_university_id_idx
  on public.watch_subscriptions (university_id) where enabled;

drop trigger if exists set_watch_subscriptions_updated_at on public.watch_subscriptions;
create trigger set_watch_subscriptions_updated_at
  before update on public.watch_subscriptions
  for each row execute function public.set_updated_at();

alter table public.watch_subscriptions enable row level security;

drop policy if exists "watch_subscriptions_select_own" on public.watch_subscriptions;
create policy "watch_subscriptions_select_own" on public.watch_subscriptions
  for select using (auth.uid() = user_id);
-- Toggling `enabled` (muting) is the only client-side write a user makes
-- directly; rows are otherwise created/repointed only by the trigger below.
drop policy if exists "watch_subscriptions_update_own" on public.watch_subscriptions;
create policy "watch_subscriptions_update_own" on public.watch_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

  insert into public.watch_subscriptions (user_id, university_id, program_id, admission_cycle_id, enabled)
  values (new.user_id, v_university_id, new.program_id, new.admission_cycle_id, true)
  on conflict (user_id, program_id) where program_id is not null
  do update set
    admission_cycle_id = coalesce(excluded.admission_cycle_id, public.watch_subscriptions.admission_cycle_id),
    university_id = excluded.university_id;
    -- Deliberately does not touch `enabled` -- an application update must
    -- never silently undo a user's manual mute.

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

create or replace function public.applications_prune_watch_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.program_id is null then
    return old;
  end if;

  -- Only drop the subscription if no other application by this user still
  -- references the same program (never delete data the user still needs).
  if not exists (
    select 1 from public.applications
    where user_id = old.user_id
      and program_id = old.program_id
      and id <> old.id
  ) then
    delete from public.watch_subscriptions
      where user_id = old.user_id and program_id = old.program_id;
  end if;

  return old;
end;
$$;

drop trigger if exists applications_delete_watch_subscription on public.applications;
create trigger applications_delete_watch_subscription
  after delete on public.applications
  for each row execute function public.applications_prune_watch_subscription();
