-- Source Validation v1: turns "a URL string is stored" into "this URL was
-- actually verified reachable, on the university's own domain, and gone
-- through". Fixes the root cause behind broken "Official source" links --
-- `sources.official_url` (and `programs.official_url`) were previously
-- trusted at face value with no HTTP-level check, so a university
-- restructuring its site (a 301, or a dead page) never got detected until a
-- human clicked through and hit a 404.
--
-- Entirely additive: no table dropped or truncated, every new column is
-- nullable or has a safe default, so all existing rows (including the one
-- production `sources` row this was written to fix) keep working unchanged
-- until the next validation run fills these in.

alter table public.sources
  add column if not exists url_status text not null default 'unknown',
  add column if not exists http_status integer,
  add column if not exists resolved_url text,
  add column if not exists last_validated_at timestamptz,
  add column if not exists validation_error text,
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists replaced_by_source_id uuid references public.sources (id) on delete set null,
  -- When this source should next be re-validated (see
  -- app/lib/live-data/sourceStatus.ts:computeNextCheckDueAt). Null means
  -- "never validated yet" -- treated as immediately due by the scheduler.
  add column if not exists next_check_due_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sources_url_status_check'
      and conrelid = 'public.sources'::regclass
  ) then
    alter table public.sources
      add constraint sources_url_status_check check (
        url_status in (
          'valid', 'redirected', 'not_found', 'gone', 'blocked',
          'timeout', 'invalid_domain', 'unknown'
        )
      );
  end if;

  -- A source can't be marked as its own replacement, and (best-effort;
  -- Postgres has no built-in cycle-prevention for self-referencing FKs
  -- beyond this) the application layer caps replacement-chain traversal at a
  -- small depth regardless.
  if not exists (
    select 1 from pg_constraint
    where conname = 'sources_replaced_by_not_self'
      and conrelid = 'public.sources'::regclass
  ) then
    alter table public.sources
      add constraint sources_replaced_by_not_self check (replaced_by_source_id <> id);
  end if;
end $$;

-- Powers `getSourcesDueForValidation()` (app/lib/live-data/scheduler.ts):
-- cheap "what needs checking next" scan instead of a full table scan.
create index if not exists sources_next_check_due_at_idx
  on public.sources (next_check_due_at);

create index if not exists sources_url_status_idx on public.sources (url_status);
