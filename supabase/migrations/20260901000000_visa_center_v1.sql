-- Visa Center v1 + self-reported journey stage.
--
-- Adds:
--   1. profiles.self_reported_stage -- the onboarding question "Where are
--      you in your study abroad journey?" (AGENTS.md section 1). Genuine new
--      user input, not derivable from any other table -- everything else the
--      Journey rail shows (funding/visa/move/arrival status) is instead
--      *computed* from the user's already-generated active Route
--      (see app/lib/journey.ts:deriveLateJourneyStatuses), never duplicated
--      into a stored column.
--   2. visa_requirement_profiles / visa_requirement_items -- official visa
--      checklist content keyed by (nationality, destination, study level),
--      deliberately NOT linked to any one university/program, since visa
--      rules are set by the destination country's government
--      (AGENTS.md section 3/4).
--   3. user_visa_journeys / user_visa_checklist_progress -- per-user tracking.
--      A user_visa_journeys row IS the notification subscription for its
--      visa_profile_id (see app/lib/live-data/notify.ts) -- no separate
--      watch_subscriptions row needed, mirroring how `applications` rows
--      already double as the subscription for university/program changes.
--   4. Extends the existing `sources` / `change_events` verified-source
--      pipeline to also cover visa content (AGENTS.md section 7: "reuse the
--      existing Verified Live Data System"), rather than a parallel one.
--
-- Entirely additive/non-destructive: no table dropped or truncated, no
-- existing column altered destructively, every new column is nullable or has
-- a safe default. Safe to paste into the Supabase SQL Editor and run once.

-- ---------------------------------------------------------------------------
-- 1. profiles.self_reported_stage
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'journey_stage') then
    create type public.journey_stage as enum (
      'exploring',
      'choosing',
      'preparing_applications',
      'applied',
      'received_offer',
      'preparing_visa',
      'preparing_move',
      'arrived'
    );
  end if;
end $$;

alter table public.profiles
  add column if not exists self_reported_stage public.journey_stage;

-- ---------------------------------------------------------------------------
-- 2. visa_requirement_profiles -- one row per (nationality, destination,
--    study level) combination UniPath has curated official guidance for.
--    `status` starts 'being_verified' and only flips to 'verified' once an
--    admin has confirmed a healthy official source is attached (see
--    app/lib/data/adminSources.ts's existing health classification, reused
--    via the `sources.visa_profile_id` link below) -- never inferred.
-- ---------------------------------------------------------------------------

create table if not exists public.visa_requirement_profiles (
  id uuid primary key default gen_random_uuid(),
  nationality_country text not null,
  destination_country text not null,
  study_level public.application_type not null,
  visa_type text,
  summary text,
  status text not null default 'being_verified' check (status in ('verified', 'being_verified')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visa_requirement_profiles_key unique (nationality_country, destination_country, study_level)
);

create index if not exists visa_requirement_profiles_lookup_idx
  on public.visa_requirement_profiles (nationality_country, destination_country, study_level);

drop trigger if exists set_visa_requirement_profiles_updated_at on public.visa_requirement_profiles;
create trigger set_visa_requirement_profiles_updated_at
  before update on public.visa_requirement_profiles
  for each row execute function public.set_updated_at();

alter table public.visa_requirement_profiles enable row level security;
drop policy if exists "visa_requirement_profiles_public_read" on public.visa_requirement_profiles;
create policy "visa_requirement_profiles_public_read" on public.visa_requirement_profiles
  for select using (true);
-- Writes are service-role only (admin curates visa content from an official
-- source), same pattern as universities/programs.

-- ---------------------------------------------------------------------------
-- 3. visa_requirement_items -- the checklist template for a profile.
--    item_key is a closed vocabulary matching the spec's own example
--    checklist so the UI can render a fixed icon/label per key even before
--    a custom title exists; only the items an admin has actually added from
--    a checked official source ever appear -- never a hardcoded full list
--    (AGENTS.md section 5: "only the items that are actually needed").
-- ---------------------------------------------------------------------------

create table if not exists public.visa_requirement_items (
  id uuid primary key default gen_random_uuid(),
  visa_profile_id uuid not null references public.visa_requirement_profiles (id) on delete cascade,
  item_key text not null check (item_key in (
    'check_visa_type', 'passport_validity', 'admission_letter', 'financial_proof',
    'accommodation_proof', 'insurance', 'application_form', 'appointment',
    'biometrics', 'submit_application', 'receive_decision', 'other'
  )),
  title text,
  description text,
  required boolean not null default true,
  order_index integer not null default 0,
  source_id uuid references public.sources (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists visa_requirement_items_profile_idx
  on public.visa_requirement_items (visa_profile_id, order_index);

alter table public.visa_requirement_items enable row level security;
drop policy if exists "visa_requirement_items_public_read" on public.visa_requirement_items;
create policy "visa_requirement_items_public_read" on public.visa_requirement_items
  for select using (true);

-- ---------------------------------------------------------------------------
-- 4. user_visa_journeys -- one per user per application that has reached an
--    admitted/committed status. Doubles as the visa change-notification
--    subscription (see app/lib/live-data/notify.ts): a user's own journey
--    row already names which visa_profile_id to notify them about.
-- ---------------------------------------------------------------------------

create table if not exists public.user_visa_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  visa_profile_id uuid not null references public.visa_requirement_profiles (id) on delete restrict,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'submitted', 'decision_received')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_visa_journeys_user_application_key
  on public.user_visa_journeys (user_id, application_id) where application_id is not null;
create index if not exists user_visa_journeys_visa_profile_idx
  on public.user_visa_journeys (visa_profile_id);

drop trigger if exists set_user_visa_journeys_updated_at on public.user_visa_journeys;
create trigger set_user_visa_journeys_updated_at
  before update on public.user_visa_journeys
  for each row execute function public.set_updated_at();

alter table public.user_visa_journeys enable row level security;
drop policy if exists "user_visa_journeys_select_own" on public.user_visa_journeys;
create policy "user_visa_journeys_select_own" on public.user_visa_journeys
  for select using (auth.uid() = user_id);
drop policy if exists "user_visa_journeys_insert_own" on public.user_visa_journeys;
create policy "user_visa_journeys_insert_own" on public.user_visa_journeys
  for insert with check (auth.uid() = user_id);
drop policy if exists "user_visa_journeys_update_own" on public.user_visa_journeys;
create policy "user_visa_journeys_update_own" on public.user_visa_journeys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. user_visa_checklist_progress -- per-user completion of each item.
-- ---------------------------------------------------------------------------

create table if not exists public.user_visa_checklist_progress (
  id uuid primary key default gen_random_uuid(),
  user_visa_journey_id uuid not null references public.user_visa_journeys (id) on delete cascade,
  visa_item_id uuid not null references public.visa_requirement_items (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_visa_checklist_progress_key unique (user_visa_journey_id, visa_item_id)
);

alter table public.user_visa_checklist_progress enable row level security;
drop policy if exists "user_visa_checklist_progress_select_own" on public.user_visa_checklist_progress;
create policy "user_visa_checklist_progress_select_own" on public.user_visa_checklist_progress
  for select using (
    exists (select 1 from public.user_visa_journeys j where j.id = user_visa_journey_id and j.user_id = auth.uid())
  );
drop policy if exists "user_visa_checklist_progress_insert_own" on public.user_visa_checklist_progress;
create policy "user_visa_checklist_progress_insert_own" on public.user_visa_checklist_progress
  for insert with check (
    exists (select 1 from public.user_visa_journeys j where j.id = user_visa_journey_id and j.user_id = auth.uid())
  );
drop policy if exists "user_visa_checklist_progress_update_own" on public.user_visa_checklist_progress;
create policy "user_visa_checklist_progress_update_own" on public.user_visa_checklist_progress
  for update using (
    exists (select 1 from public.user_visa_journeys j where j.id = user_visa_journey_id and j.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.user_visa_journeys j where j.id = user_visa_journey_id and j.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6. Extend `sources` to also link to a visa_requirement_profile -- still
--    capped at exactly one entity per source, same invariant as before.
-- ---------------------------------------------------------------------------

alter table public.sources
  add column if not exists visa_profile_id uuid references public.visa_requirement_profiles (id) on delete cascade;

create index if not exists sources_visa_profile_id_idx on public.sources (visa_profile_id);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'sources_single_entity_link' and conrelid = 'public.sources'::regclass
  ) then
    alter table public.sources drop constraint sources_single_entity_link;
  end if;
  alter table public.sources
    add constraint sources_single_entity_link check (
      (case when university_id is not null then 1 else 0 end) +
      (case when program_id is not null then 1 else 0 end) +
      (case when admission_cycle_id is not null then 1 else 0 end) +
      (case when visa_profile_id is not null then 1 else 0 end) <= 1
    );
end $$;

-- ---------------------------------------------------------------------------
-- 7. Extend change_events.entity_type to also cover visa_requirement_profile
--    -- the same detected -> pending_review -> approved -> applied pipeline
--    /admin/changes already runs, now also driving Visa Change Notifications
--    (AGENTS.md section 7). Drops whichever the original inline check
--    constraint's auto-generated name turned out to be, rather than assuming
--    it, since it was declared without an explicit name.
-- ---------------------------------------------------------------------------

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.change_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%entity_type%';

  if v_conname is not null then
    execute format('alter table public.change_events drop constraint %I', v_conname);
  end if;

  alter table public.change_events
    add constraint change_events_entity_type_check check (
      entity_type in ('university', 'program', 'admission_cycle', 'visa_requirement_profile')
    );
end $$;
