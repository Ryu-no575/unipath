-- Credential Model Extension + International Student Data v1
--
-- Personalized Planning Engine Phase 1: broadens the credential vocabulary
-- (CEFR levels, Italian language certs, AP, institution-specific entrance
-- exams, structured secondary-qualification types) and adds international
-- student statistics to the canonical university catalog.
--
-- Entirely additive: no table dropped or truncated, no existing column
-- altered destructively, every new column is nullable with no backfill.
-- Existing rows (including every enum value already in use) keep working
-- unchanged. Safe to paste into the Supabase SQL Editor and run once.

-- ---------------------------------------------------------------------------
-- 1. test_scores.test_type: broaden the vocabulary.
--
-- Plain top-level ALTER TYPE ... ADD VALUE IF NOT EXISTS (not wrapped in a
-- do $$ block -- ALTER TYPE ... ADD VALUE cannot run inside a function/DO
-- block, only as a bare top-level statement) is itself idempotent and safe
-- to rerun. Nothing later in this file uses these new values in an
-- expression, so there's no same-transaction visibility hazard.
-- ---------------------------------------------------------------------------

alter type public.test_type add value if not exists 'duolingo';
alter type public.test_type add value if not exists 'cils';
alter type public.test_type add value if not exists 'celi';
alter type public.test_type add value if not exists 'plida';
alter type public.test_type add value if not exists 'cert_it';
alter type public.test_type add value if not exists 'ap';
-- Institution-specific entrance exams (e.g. Politecnico di Milano's ARCHED,
-- Politecnico di Torino's TIL-A) are too numerous and non-standardized to
-- enumerate -- this value pairs with the new test_scores.custom_test_name
-- column below instead of hardcoding every university's own exam name.
alter type public.test_type add value if not exists 'university_specific';

-- ---------------------------------------------------------------------------
-- 2. cefr_level: new enum for language certificates that report a CEFR band
--    directly (PLIDA, CELI, Cambridge English) rather than a numeric score.
--    Never auto-derived from a numeric score elsewhere in the app (e.g. no
--    IELTS-to-CEFR guessing) -- only ever set when a user enters it directly
--    for a test that actually reports one.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cefr_level') then
    create type public.cefr_level as enum ('a1', 'a2', 'b1', 'b2', 'c1', 'c2');
  end if;
end $$;

alter table public.test_scores
  add column if not exists cefr_level public.cefr_level,
  -- Free-text companion for test_type = 'university_specific' (or 'other') --
  -- e.g. "ARCHED", "TIL-A". Ignored for every other test_type.
  add column if not exists custom_test_name text;

-- ---------------------------------------------------------------------------
-- 3. secondary_qualification_type: structured academic-qualification vocabulary
--    (task brief: Japanese high school diploma / IB Diploma / A-Levels /
--    Abitur / French Baccalauréat / other national secondary / Bachelor /
--    Master). Added to both `profiles` (the user's primary/current
--    qualification) and `education_history` (additional entries) -- the
--    existing free-text `education_level` column on both tables is kept
--    as-is as the human-readable label/supplement (e.g. the specific name of
--    a country's diploma when qualification_type = 'other_national_secondary').
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'secondary_qualification_type') then
    create type public.secondary_qualification_type as enum (
      'national_secondary_diploma', 'ib_diploma', 'a_levels', 'abitur',
      'french_baccalaureat', 'other_national_secondary',
      'bachelor_degree', 'master_degree'
    );
  end if;
end $$;

alter table public.profiles
  add column if not exists qualification_type public.secondary_qualification_type;

alter table public.education_history
  add column if not exists qualification_type public.secondary_qualification_type;

-- ---------------------------------------------------------------------------
-- 4. International student data on `universities`. All nullable, no backfill
--    -- the UI renders "Being verified" whenever these are null, never an
--    estimated figure (task brief: "Do not estimate"). No automated importer
--    exists for this data (no specified source of truth) -- populated only
--    via admin entry, mirroring the existing manual-curation pattern already
--    used for `data_source = 'manual'` rows.
-- ---------------------------------------------------------------------------

alter table public.universities
  add column if not exists total_students integer,
  add column if not exists international_students integer,
  add column if not exists international_student_percentage numeric(5, 2),
  -- e.g. "2025/26" -- kept as free text since academic-year conventions
  -- differ by country (calendar year vs. split year).
  add column if not exists student_stats_academic_year text,
  add column if not exists student_stats_source_name text,
  add column if not exists student_stats_source_url text,
  add column if not exists student_stats_last_verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'universities_international_student_percentage_check'
      and conrelid = 'public.universities'::regclass
  ) then
    alter table public.universities
      add constraint universities_international_student_percentage_check check (
        international_student_percentage is null
        or (international_student_percentage >= 0 and international_student_percentage <= 100)
      );
  end if;
end $$;
