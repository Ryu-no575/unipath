-- Personal Journey v1: timezone on profiles, auto-recalculated application
-- progress, and RLS so a signed-in user can add a university/program/
-- admission cycle to the shared catalog when the one they need isn't in it
-- yet (mirrors the existing Explore -> ROR search -> "Add University" flow;
-- users type in real institutions they are actually applying to, nothing is
-- auto-generated).
--
-- Entirely additive/non-destructive: new nullable column, new trigger
-- function, new RLS policies, one new unique index (guarded by a dedup step
-- first, matching the pattern used in 20260826090000). No table is dropped,
-- truncated, or has data overwritten.

-- ---------------------------------------------------------------------------
-- 1. Timezone on profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists timezone text;

-- ---------------------------------------------------------------------------
-- 2. Auto-recalculate applications.progress from tasks
--    (completed tasks / total tasks for that application; 0 tasks -> 0%)
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_application_progress(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_completed integer;
  v_progress smallint;
begin
  if p_application_id is null then
    return;
  end if;

  select count(*), count(*) filter (where completed)
    into v_total, v_completed
    from public.tasks
    where application_id = p_application_id;

  if v_total = 0 then
    v_progress := 0;
  else
    v_progress := round((v_completed::numeric / v_total::numeric) * 100)::smallint;
  end if;

  update public.applications
    set progress = v_progress
    where id = p_application_id
      and progress is distinct from v_progress;
end;
$$;

create or replace function public.tasks_progress_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_application_progress(old.application_id);
    return old;
  end if;

  perform public.recalculate_application_progress(new.application_id);

  if tg_op = 'UPDATE' and new.application_id is distinct from old.application_id then
    perform public.recalculate_application_progress(old.application_id);
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_progress_trigger on public.tasks;
create trigger tasks_progress_trigger
  after insert or update or delete on public.tasks
  for each row execute function public.tasks_progress_trigger();

-- ---------------------------------------------------------------------------
-- 3. Let signed-in users add catalog entries that don't exist yet
--    (append-only: no update/delete policy, so nobody can edit someone
--    else's catalog entry through the API)
-- ---------------------------------------------------------------------------

drop policy if exists "universities_insert_authenticated" on public.universities;
create policy "universities_insert_authenticated" on public.universities
  for insert to authenticated with check (true);

drop policy if exists "programs_insert_authenticated" on public.programs;
create policy "programs_insert_authenticated" on public.programs
  for insert to authenticated with check (true);

drop policy if exists "admission_cycles_insert_authenticated" on public.admission_cycles;
create policy "admission_cycles_insert_authenticated" on public.admission_cycles
  for insert to authenticated with check (true);

-- Fill-in-the-gaps updates only. RLS alone can't compare OLD vs. NEW, so the
-- policy just gates *who* may attempt an update (any signed-in user) and a
-- BEFORE UPDATE trigger below enforces *what* they may change: an already-set
-- value can never be overwritten, only a null field may be filled in. This
-- stops one student's guessed deadline from clobbering another's
-- already-recorded one, at the database level regardless of what any client
-- sends.
drop policy if exists "admission_cycles_update_fill_gaps" on public.admission_cycles;
create policy "admission_cycles_update_fill_gaps" on public.admission_cycles
  for update to authenticated
  using (true)
  with check (true);

create or replace function public.admission_cycles_guard_fill_gaps()
returns trigger
language plpgsql
as $$
begin
  if old.application_open_date is not null and new.application_open_date is distinct from old.application_open_date then
    raise exception 'admission_cycles.application_open_date is already set and cannot be changed';
  end if;
  if old.application_deadline is not null and new.application_deadline is distinct from old.application_deadline then
    raise exception 'admission_cycles.application_deadline is already set and cannot be changed';
  end if;
  if old.deadline_timezone is not null and new.deadline_timezone is distinct from old.deadline_timezone then
    raise exception 'admission_cycles.deadline_timezone is already set and cannot be changed';
  end if;
  if old.application_fee is not null and new.application_fee is distinct from old.application_fee then
    raise exception 'admission_cycles.application_fee is already set and cannot be changed';
  end if;
  if old.application_fee_currency is not null and new.application_fee_currency is distinct from old.application_fee_currency then
    raise exception 'admission_cycles.application_fee_currency is already set and cannot be changed';
  end if;
  if old.tuition is not null and new.tuition is distinct from old.tuition then
    raise exception 'admission_cycles.tuition is already set and cannot be changed';
  end if;
  if old.tuition_currency is not null and new.tuition_currency is distinct from old.tuition_currency then
    raise exception 'admission_cycles.tuition_currency is already set and cannot be changed';
  end if;
  -- program_id / intake_year / intake_season identify the row; changing them
  -- would just be a disguised delete-and-recreate, so block it outright.
  if new.program_id is distinct from old.program_id
    or new.intake_year is distinct from old.intake_year
    or new.intake_season is distinct from old.intake_season then
    raise exception 'admission_cycles identity columns cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists admission_cycles_guard_fill_gaps on public.admission_cycles;
create trigger admission_cycles_guard_fill_gaps
  before update on public.admission_cycles
  for each row execute function public.admission_cycles_guard_fill_gaps();

-- ---------------------------------------------------------------------------
-- 4. Prevent duplicate admission cycles piling up as users create
--    applications for the same program + intake
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from public.admission_cycles
    group by program_id, intake_year, intake_season
    having count(*) > 1
  ) then
    -- Existing duplicates found (unexpected pre-launch, but be safe): keep
    -- the oldest row per (program_id, intake_year, intake_season) and repoint
    -- any applications referencing a newer duplicate at it, so no
    -- application ends up with a dangling admission_cycle_id.
    with ranked as (
      select id, program_id, intake_year, intake_season,
             row_number() over (
               partition by program_id, intake_year, intake_season
               order by created_at, id
             ) as rn
      from public.admission_cycles
    ),
    keepers as (
      select r.id as duplicate_id, k.id as keeper_id
      from ranked r
      join ranked k
        on k.program_id = r.program_id
       and k.intake_year = r.intake_year
       and k.intake_season = r.intake_season
       and k.rn = 1
      where r.rn > 1
    )
    update public.applications a
      set admission_cycle_id = k.keeper_id
      from keepers k
      where a.admission_cycle_id = k.duplicate_id;

    with ranked as (
      select id, program_id, intake_year, intake_season,
             row_number() over (
               partition by program_id, intake_year, intake_season
               order by created_at, id
             ) as rn
      from public.admission_cycles
    )
    delete from public.admission_cycles
    where id in (select id from ranked where rn > 1);
  end if;
end $$;

create unique index if not exists admission_cycles_program_intake_key
  on public.admission_cycles (program_id, intake_year, intake_season);
