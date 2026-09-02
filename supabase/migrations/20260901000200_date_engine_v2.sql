-- Date Engine v2 -- real anchors for Visa/Housing/Travel/Arrival.
--
-- Context: app/lib/routes/steps.ts was computing Visa, Housing, and Travel
-- dates with the exact same backward-planning mechanism as Application prep
-- steps (a hand-picked day range backward from the *application* deadline),
-- because none of these domains had a real anchor in the schema. This
-- migration adds those anchors -- everything nullable, everything populated
-- the same curator-direct-edit way admission_cycles.application_deadline
-- already is (there is no admin CRUD for admission_cycles), except the Visa
-- timing fields, which get a real edit form (AdminVisaForms.tsx). No number
-- is pre-filled here: every new column starts NULL, and the app renders
-- "Estimated window" / "Being verified" until a real official source
-- confirms a value.
--
-- Entirely additive/non-destructive: no table dropped or truncated, no
-- existing column altered destructively, every new column is nullable. Safe
-- to paste into the Supabase SQL Editor and run once. Run
-- `supabase gen types typescript` afterward to confirm generated types match
-- the hand-written ones already in app/lib/supabase/database.types.ts.

-- ---------------------------------------------------------------------------
-- 1. admission_cycles -- real program logistics dates (Housing/Travel/Arrival
--    anchors), distinct from application_deadline.
-- ---------------------------------------------------------------------------

alter table public.admission_cycles
  add column if not exists program_start_date date,
  add column if not exists orientation_date date,
  add column if not exists housing_deadline timestamptz,
  add column if not exists housing_move_in_date timestamptz;

-- ---------------------------------------------------------------------------
-- 2. visa_requirement_profiles -- official visa timing (Visa Date Engine
--    anchor). Populated by an admin via AdminVisaForms.tsx once a real
--    government/embassy source confirms the number.
-- ---------------------------------------------------------------------------

alter table public.visa_requirement_profiles
  add column if not exists earliest_application_months_before_start integer,
  add column if not exists processing_weeks_min integer,
  add column if not exists processing_weeks_max integer,
  add column if not exists latest_safe_submission_weeks_before_start integer;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'visa_requirement_profiles_processing_weeks_check'
      and conrelid = 'public.visa_requirement_profiles'::regclass
  ) then
    alter table public.visa_requirement_profiles
      drop constraint visa_requirement_profiles_processing_weeks_check;
  end if;
  alter table public.visa_requirement_profiles
    add constraint visa_requirement_profiles_processing_weeks_check check (
      processing_weeks_min is null or processing_weeks_max is null or processing_weeks_min <= processing_weeks_max
    );
end $$;

-- ---------------------------------------------------------------------------
-- 3. visa_requirement_items -- post-arrival legal deadlines (Arrival Date
--    Engine), plus 4 new item keys to describe them.
-- ---------------------------------------------------------------------------

alter table public.visa_requirement_items
  add column if not exists deadline_days_after_arrival integer;

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.visa_requirement_items'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%item_key%';

  if v_conname is not null then
    execute format('alter table public.visa_requirement_items drop constraint %I', v_conname);
  end if;

  alter table public.visa_requirement_items
    add constraint visa_requirement_items_item_key_check check (item_key in (
      'check_visa_type', 'passport_validity', 'admission_letter', 'financial_proof',
      'accommodation_proof', 'insurance', 'application_form', 'appointment',
      'biometrics', 'submit_application', 'receive_decision',
      'residence_permit_registration', 'local_registration',
      'student_card_registration', 'health_registration', 'other'
    ));
end $$;
