-- Real University Data v1: schema support for importing real institutions
-- (via ROR) and tracking where every catalog fact came from.
--
-- Entirely additive: no table dropped or truncated, every new column is
-- nullable or has a safe default, so all existing rows keep working
-- unchanged.

-- ---------------------------------------------------------------------------
-- 1. universities: where this row's core facts came from (ROR, manual
--    curation, ...) and when they were last synced. `ror_id` already existed
--    (see 20260825120000_core_schema.sql) as the de-dup key for importers --
--    no new identifier column needed.
-- ---------------------------------------------------------------------------

alter table public.universities
  add column if not exists data_source text,
  add column if not exists source_url text,
  add column if not exists last_synced_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'universities_data_source_check'
      and conrelid = 'public.universities'::regclass
  ) then
    alter table public.universities
      add constraint universities_data_source_check check (
        data_source is null or data_source in ('ror', 'manual')
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. programs: when a curator last confirmed this program's fields against
--    its official page. Distinct from `sources.verified_at` (which is about
--    a specific URL) -- this is about the program row as a whole.
-- ---------------------------------------------------------------------------

alter table public.programs
  add column if not exists verified_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. admission_requirements: how confident the linked source makes us about
--    this specific requirement value -- shown next to the source link so
--    "high confidence" never has to be taken on faith (see AGENTS.md task
--    notes on Verification).
-- ---------------------------------------------------------------------------

alter table public.admission_requirements
  add column if not exists confidence text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admission_requirements_confidence_check'
      and conrelid = 'public.admission_requirements'::regclass
  ) then
    alter table public.admission_requirements
      add constraint admission_requirements_confidence_check check (
        confidence is null or confidence in ('high', 'medium', 'low')
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. change_events: mark rows written by a developer seed/simulate tool
--    (scripts/seed-live-data-demo.mjs, app/lib/live-data/simulate.ts) instead
--    of a real checkSource() detection, so an admin view can always tell
--    them apart from a genuine official-source change. Both write paths are
--    already environment-gated (simulate.ts refuses outside development;
--    the seed script is being given the same guard alongside this
--    migration) -- this column is the audit trail on top of that gate, not a
--    replacement for it.
-- ---------------------------------------------------------------------------

alter table public.change_events
  add column if not exists is_simulated boolean not null default false;
