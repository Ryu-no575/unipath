-- Public Beta Feedback + Analytics Events v1 (AGENTS.md sections 18/19/20).
--
-- Two lightweight, append-only tables:
--   1. user_feedback -- the always-available "send feedback" widget. Any
--      signed-in or guest visitor may insert their own row (or a null-user
--      row for a guest); only an admin (service role) can read them.
--   2. analytics_events -- a closed vocabulary of product events, storing
--      only the event name + small non-identifying properties (never
--      Documents content or free-text PII) -- never queried by regular
--      users, only aggregated by an admin.
--
-- Entirely additive/non-destructive. Safe to paste into the Supabase SQL
-- Editor and run once.

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  category text not null check (category in (
    'confusing', 'wrong_information', 'missing_university', 'bug', 'feature_request', 'other'
  )),
  message text not null,
  page_path text,
  status text not null default 'new' check (status in ('new', 'reviewed')),
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_status_idx on public.user_feedback (status, created_at desc);
create index if not exists user_feedback_user_id_idx on public.user_feedback (user_id);

alter table public.user_feedback enable row level security;
drop policy if exists "user_feedback_insert_any" on public.user_feedback;
create policy "user_feedback_insert_any" on public.user_feedback
  for insert with check (user_id is null or auth.uid() = user_id);
-- Deliberately no select policy for anon/authenticated -- read only via the
-- service role from /admin/feedback (app/lib/data/adminFeedback.ts), same
-- pattern as admin_audit_logs.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null check (event_name in (
    'visit', 'signup_started', 'signup_completed', 'onboarding_completed',
    'match_started', 'match_completed', 'route_viewed', 'university_saved',
    'application_added', 'visa_started', 'community_posted'
  )),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_idx on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_user_id_idx on public.analytics_events (user_id);

alter table public.analytics_events enable row level security;
drop policy if exists "analytics_events_insert_any" on public.analytics_events;
create policy "analytics_events_insert_any" on public.analytics_events
  for insert with check (user_id is null or auth.uid() = user_id);
-- Deliberately no select policy -- aggregated only via the service role.
