-- UniPath Community v1
--
-- Adds a minimal, real (non-DM) discussion layer scoped to one university:
-- posts, threaded comments (1-2 levels), likes, reports, and a block-list
-- architecture (no UI yet). Adds a new `community_profiles` table for the
-- user's public community identity (status + separate verification flag) --
-- kept out of `public.profiles` because that table is select-own-only and
-- holds private data (GPA, budget, nationality) that must never become
-- publicly readable. Reuses the existing `notifications` table (adds
-- nullable community pointers) instead of building a parallel system -- see
-- AGENTS.md task notes on Community v1.
--
-- Entirely additive: no table, row, or existing column is dropped, no data
-- is deleted, and RLS is enabled (never disabled) on every new table. Safe
-- to paste into the Supabase SQL Editor and run once.

-- ---------------------------------------------------------------------------
-- 0. set_updated_at() -- create only if missing (already exists from
--    20260825120000_core_schema.sql; re-affirmed defensively like other
--    migrations in this repo do).
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
-- 1. Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'student_status') then
    create type public.student_status as enum (
      'applicant', 'admitted', 'current_student', 'alumni'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'community_post_type') then
    create type public.community_post_type as enum (
      'question', 'discussion', 'experience', 'housing', 'admissions',
      'visa', 'portfolio', 'campus', 'city_life', 'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'community_report_status') then
    create type public.community_report_status as enum (
      'pending', 'reviewed', 'resolved', 'dismissed'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. community_profiles -- the user's *public* community identity, kept in
--    its own table rather than added to `public.profiles`. `profiles` is
--    select-own-only (it holds GPA, budget, nationality, etc.), so columns
--    added there could never be read by other users to render "who posted
--    this" -- and a public-read policy on `profiles` itself would leak all
--    of that private data, not just the 3 fields Community needs. Status and
--    its verification are deliberately separate columns: setting a status
--    must never imply verification.
-- ---------------------------------------------------------------------------

create table if not exists public.community_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  student_status public.student_status,
  student_status_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_community_profiles_updated_at on public.community_profiles;
create trigger set_community_profiles_updated_at
  before update on public.community_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. community_posts
-- ---------------------------------------------------------------------------

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  university_id uuid not null references public.universities (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  admission_cycle_id uuid references public.admission_cycles (id) on delete set null,
  post_type public.community_post_type not null default 'discussion',
  title text,
  body text not null,
  -- BCP-47-ish tag (e.g. "ja", "en") for the future Original/Translated
  -- toggle -- not used for filtering or translation yet.
  language_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists community_posts_university_idx
  on public.community_posts (university_id, created_at desc);
create index if not exists community_posts_program_idx
  on public.community_posts (program_id);
create index if not exists community_posts_admission_cycle_idx
  on public.community_posts (admission_cycle_id);
create index if not exists community_posts_user_idx
  on public.community_posts (user_id);
create index if not exists community_posts_type_idx
  on public.community_posts (university_id, post_type);

drop trigger if exists set_community_posts_updated_at on public.community_posts;
create trigger set_community_posts_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. community_comments -- parent_comment_id allows 1-2 levels of replies
-- ---------------------------------------------------------------------------

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_comment_id uuid references public.community_comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at);
create index if not exists community_comments_parent_idx
  on public.community_comments (parent_comment_id);
create index if not exists community_comments_user_idx
  on public.community_comments (user_id);

drop trigger if exists set_community_comments_updated_at on public.community_comments;
create trigger set_community_comments_updated_at
  before update on public.community_comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. community_post_likes -- one like per (user, post); no surrogate id, as
--    the natural key is the whole point of the uniqueness guarantee.
-- ---------------------------------------------------------------------------

create table if not exists public.community_post_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid not null references public.community_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists community_post_likes_post_idx
  on public.community_post_likes (post_id);

-- ---------------------------------------------------------------------------
-- 6. community_reports -- moderation queue; v1 has no admin UI, but every
--    report is durably saved with a reviewable status.
-- ---------------------------------------------------------------------------

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  reason text not null,
  details text,
  status public.community_report_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint community_reports_target_check
    check (post_id is not null or comment_id is not null)
);

create index if not exists community_reports_reporter_idx
  on public.community_reports (reporter_user_id);
create index if not exists community_reports_status_idx
  on public.community_reports (status);

-- ---------------------------------------------------------------------------
-- 7. user_blocks -- architecture only for v1 (no UI wired up yet), so the
--    data model doesn't have to be retrofitted later.
-- ---------------------------------------------------------------------------

create table if not exists public.user_blocks (
  blocker_user_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  constraint user_blocks_not_self check (blocker_user_id <> blocked_user_id)
);

-- ---------------------------------------------------------------------------
-- 8. notifications -- reuse the existing table; add nullable pointers back
--    to the community content a notification is about instead of building a
--    second notification system.
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists community_post_id uuid references public.community_posts (id) on delete cascade,
  add column if not exists community_comment_id uuid references public.community_comments (id) on delete cascade;

create index if not exists notifications_community_post_idx
  on public.notifications (community_post_id);

-- ---------------------------------------------------------------------------
-- 9. RLS -- community content is publicly readable (no PII in it -- see
--    app/lib/data/community.ts, which never selects email), writable only by
--    its owner. Reports are private to their author. Blocks are private to
--    the blocker. RLS is enabled on every table below; there is no
--    insert/update/delete policy for anon/authenticated where the app never
--    needs one (e.g. hard-deleting a post -- deletion is soft, via the
--    existing update-own policy setting deleted_at).
-- ---------------------------------------------------------------------------

alter table public.community_profiles enable row level security;

drop policy if exists "community_profiles_public_read" on public.community_profiles;
create policy "community_profiles_public_read" on public.community_profiles
  for select using (true);

drop policy if exists "community_profiles_insert_own" on public.community_profiles;
create policy "community_profiles_insert_own" on public.community_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "community_profiles_update_own" on public.community_profiles;
create policy "community_profiles_update_own" on public.community_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.community_posts enable row level security;

drop policy if exists "community_posts_public_read" on public.community_posts;
create policy "community_posts_public_read" on public.community_posts
  for select using (true);

drop policy if exists "community_posts_insert_own" on public.community_posts;
create policy "community_posts_insert_own" on public.community_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "community_posts_update_own" on public.community_posts;
create policy "community_posts_update_own" on public.community_posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.community_comments enable row level security;

drop policy if exists "community_comments_public_read" on public.community_comments;
create policy "community_comments_public_read" on public.community_comments
  for select using (true);

drop policy if exists "community_comments_insert_own" on public.community_comments;
create policy "community_comments_insert_own" on public.community_comments
  for insert with check (auth.uid() = user_id);

drop policy if exists "community_comments_update_own" on public.community_comments;
create policy "community_comments_update_own" on public.community_comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.community_post_likes enable row level security;

drop policy if exists "community_post_likes_public_read" on public.community_post_likes;
create policy "community_post_likes_public_read" on public.community_post_likes
  for select using (true);

drop policy if exists "community_post_likes_insert_own" on public.community_post_likes;
create policy "community_post_likes_insert_own" on public.community_post_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "community_post_likes_delete_own" on public.community_post_likes;
create policy "community_post_likes_delete_own" on public.community_post_likes
  for delete using (auth.uid() = user_id);

alter table public.community_reports enable row level security;

drop policy if exists "community_reports_select_own" on public.community_reports;
create policy "community_reports_select_own" on public.community_reports
  for select using (auth.uid() = reporter_user_id);

drop policy if exists "community_reports_insert_own" on public.community_reports;
create policy "community_reports_insert_own" on public.community_reports
  for insert with check (auth.uid() = reporter_user_id);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_select_own" on public.user_blocks;
create policy "user_blocks_select_own" on public.user_blocks
  for select using (auth.uid() = blocker_user_id);

drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own" on public.user_blocks
  for insert with check (auth.uid() = blocker_user_id);

drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own" on public.user_blocks
  for delete using (auth.uid() = blocker_user_id);
