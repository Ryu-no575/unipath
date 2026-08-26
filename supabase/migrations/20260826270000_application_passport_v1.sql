-- Application Passport v1
--
-- Lets a user register their education history, test scores, and application
-- documents once and reuse them across every university application, plus a
-- per-application Readiness view that cross-checks admission_requirements
-- (real source data only -- see AGENTS.md task notes: "AI organizes, sources
-- decide") against what the user actually has.
--
-- Deliberately does NOT store passport numbers, national IDs, or any other
-- government-identity data -- see the v1 scope note in the task brief.
--
-- Entirely additive: no table, row, or existing column is dropped, no data
-- is deleted, and RLS is enabled (never disabled) on every new table. Safe
-- to paste into the Supabase SQL Editor and run once.

-- ---------------------------------------------------------------------------
-- 0. set_updated_at() -- create only if missing (defensive, like
--    20260826260000_community_v1.sql).
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
  if not exists (select 1 from pg_type where typname = 'test_type') then
    create type public.test_type as enum (
      'ielts', 'toefl', 'cambridge', 'sat', 'act', 'gre', 'gmat', 'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_type') then
    create type public.document_type as enum (
      'cv', 'transcript', 'portfolio', 'motivation_letter', 'personal_statement',
      'recommendation', 'english_certificate', 'degree_certificate', 'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type public.document_status as enum (
      'draft', 'ready', 'submitted', 'expired'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. education_history -- additional schools/degrees beyond the single
--    "most recent education" already captured on public.profiles
--    (education_level / previous_institution / gpa_value / gpa_scale).
--    Passport reuses those profile columns for the primary entry instead of
--    duplicating them here -- this table is only for *extra* entries the
--    user adds (e.g. a bachelor's on top of the profile's current master's).
-- ---------------------------------------------------------------------------

create table if not exists public.education_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_name text not null,
  country_code text,
  education_level text,
  field_of_study text,
  start_date date,
  end_date date,
  graduation_date date,
  gpa_value numeric(5, 3),
  gpa_scale numeric(5, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists education_history_user_id_idx on public.education_history (user_id);

drop trigger if exists set_education_history_updated_at on public.education_history;
create trigger set_education_history_updated_at
  before update on public.education_history
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. test_scores -- every test attempt the user wants tracked (IELTS,
--    TOEFL, Cambridge, SAT, ACT, GRE, GMAT, Other). Distinct from
--    profiles.english_test_type/score (that single field stays as-is and is
--    read by Passport as the user's "primary" English test so it is never
--    re-entered here).
-- ---------------------------------------------------------------------------

create table if not exists public.test_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  test_type public.test_type not null,
  overall_score text,
  component_scores jsonb,
  test_date date,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists test_scores_user_id_idx on public.test_scores (user_id);

drop trigger if exists set_test_scores_updated_at on public.test_scores;
create trigger set_test_scores_updated_at
  before update on public.test_scores
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. application_documents -- the user's reusable document library. Each row
--    is the *current* version pointer (storage_path); every upload/replace
--    also appends a row to application_document_versions below, so
--    "Replace" never destroys the previous file (see task brief item 16).
-- ---------------------------------------------------------------------------

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type public.document_type not null,
  title text not null,
  storage_path text,
  status public.document_status not null default 'draft',
  language_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_documents_user_id_idx on public.application_documents (user_id);

drop trigger if exists set_application_documents_updated_at on public.application_documents;
create trigger set_application_documents_updated_at
  before update on public.application_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. application_document_versions -- append-only upload history for a
--    document. application_documents.storage_path always mirrors the most
--    recent row here; kept structurally separate now so a future version
--    history UI is additive, not a schema change.
-- ---------------------------------------------------------------------------

create table if not exists public.application_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.application_documents (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists application_document_versions_document_id_idx
  on public.application_document_versions (document_id);

-- ---------------------------------------------------------------------------
-- 6. application_document_links -- junction for documents whose content is
--    specific to one application (motivation letter, personal statement,
--    a particular portfolio version). Reusable document types (CV,
--    transcript, recommendation, English/degree certificate) are matched to
--    every application by document_type alone and never need a link row --
--    see app/lib/passport/readiness.ts.
-- ---------------------------------------------------------------------------

create table if not exists public.application_document_links (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  document_id uuid not null references public.application_documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (application_id, document_id)
);

create index if not exists application_document_links_application_id_idx
  on public.application_document_links (application_id);
create index if not exists application_document_links_document_id_idx
  on public.application_document_links (document_id);

-- ---------------------------------------------------------------------------
-- 7. RLS -- every table here is private, own-rows-only, same pattern as
--    tasks/applications in 20260825120100_row_level_security.sql. The two
--    tables with no direct user_id column (versions, links) gate through an
--    EXISTS check on their owned parent row instead.
-- ---------------------------------------------------------------------------

alter table public.education_history enable row level security;

drop policy if exists "education_history_select_own" on public.education_history;
create policy "education_history_select_own" on public.education_history
  for select using (auth.uid() = user_id);
drop policy if exists "education_history_insert_own" on public.education_history;
create policy "education_history_insert_own" on public.education_history
  for insert with check (auth.uid() = user_id);
drop policy if exists "education_history_update_own" on public.education_history;
create policy "education_history_update_own" on public.education_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "education_history_delete_own" on public.education_history;
create policy "education_history_delete_own" on public.education_history
  for delete using (auth.uid() = user_id);

alter table public.test_scores enable row level security;

drop policy if exists "test_scores_select_own" on public.test_scores;
create policy "test_scores_select_own" on public.test_scores
  for select using (auth.uid() = user_id);
drop policy if exists "test_scores_insert_own" on public.test_scores;
create policy "test_scores_insert_own" on public.test_scores
  for insert with check (auth.uid() = user_id);
drop policy if exists "test_scores_update_own" on public.test_scores;
create policy "test_scores_update_own" on public.test_scores
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "test_scores_delete_own" on public.test_scores;
create policy "test_scores_delete_own" on public.test_scores
  for delete using (auth.uid() = user_id);

alter table public.application_documents enable row level security;

drop policy if exists "application_documents_select_own" on public.application_documents;
create policy "application_documents_select_own" on public.application_documents
  for select using (auth.uid() = user_id);
drop policy if exists "application_documents_insert_own" on public.application_documents;
create policy "application_documents_insert_own" on public.application_documents
  for insert with check (auth.uid() = user_id);
drop policy if exists "application_documents_update_own" on public.application_documents;
create policy "application_documents_update_own" on public.application_documents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "application_documents_delete_own" on public.application_documents;
create policy "application_documents_delete_own" on public.application_documents
  for delete using (auth.uid() = user_id);

alter table public.application_document_versions enable row level security;

drop policy if exists "application_document_versions_select_own" on public.application_document_versions;
create policy "application_document_versions_select_own" on public.application_document_versions
  for select using (
    exists (
      select 1 from public.application_documents d
      where d.id = application_document_versions.document_id and d.user_id = auth.uid()
    )
  );
drop policy if exists "application_document_versions_insert_own" on public.application_document_versions;
create policy "application_document_versions_insert_own" on public.application_document_versions
  for insert with check (
    exists (
      select 1 from public.application_documents d
      where d.id = application_document_versions.document_id and d.user_id = auth.uid()
    )
  );
drop policy if exists "application_document_versions_delete_own" on public.application_document_versions;
create policy "application_document_versions_delete_own" on public.application_document_versions
  for delete using (
    exists (
      select 1 from public.application_documents d
      where d.id = application_document_versions.document_id and d.user_id = auth.uid()
    )
  );

alter table public.application_document_links enable row level security;

drop policy if exists "application_document_links_select_own" on public.application_document_links;
create policy "application_document_links_select_own" on public.application_document_links
  for select using (
    exists (
      select 1 from public.applications a
      where a.id = application_document_links.application_id and a.user_id = auth.uid()
    )
    and exists (
      select 1 from public.application_documents d
      where d.id = application_document_links.document_id and d.user_id = auth.uid()
    )
  );
drop policy if exists "application_document_links_insert_own" on public.application_document_links;
create policy "application_document_links_insert_own" on public.application_document_links
  for insert with check (
    exists (
      select 1 from public.applications a
      where a.id = application_document_links.application_id and a.user_id = auth.uid()
    )
    and exists (
      select 1 from public.application_documents d
      where d.id = application_document_links.document_id and d.user_id = auth.uid()
    )
  );
drop policy if exists "application_document_links_delete_own" on public.application_document_links;
create policy "application_document_links_delete_own" on public.application_document_links
  for delete using (
    exists (
      select 1 from public.applications a
      where a.id = application_document_links.application_id and a.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Storage -- private bucket for uploaded document files. Never public;
--    every read goes through a short-lived signed URL minted server-side
--    (see app/lib/actions/passport-documents.ts), never the service-role
--    key, never a stored public URL. Object paths are always
--    "<user_id>/<document_id>/<filename>", so the policies below (matching
--    the first path segment against auth.uid()) are sufficient to guarantee
--    a user can only reach their own files.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('application-documents', 'application-documents', false)
on conflict (id) do nothing;

drop policy if exists "application_documents_storage_select_own" on storage.objects;
create policy "application_documents_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "application_documents_storage_insert_own" on storage.objects;
create policy "application_documents_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "application_documents_storage_update_own" on storage.objects;
create policy "application_documents_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "application_documents_storage_delete_own" on storage.objects;
create policy "application_documents_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
