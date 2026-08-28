-- Admin Role System v1 + light-weight source rejection.
--
-- Adds the minimum schema needed for a real (server-side enforced) two-role
-- system -- user / admin -- plus an audit trail for admin actions, and a
-- user-facing "request this university be added" record derived from the
-- existing user_custom_universities table (no new request table needed --
-- see the admin dashboard's "Requested Universities" section).
--
-- Design decisions (see AGENTS.md task notes on Role System / Security):
--   * role is stored in its own `user_roles` table, never as a column on
--     `profiles` -- a compromised/careless client write to `profiles` (which
--     already allows the owning user to update their own row) must never be
--     able to grant admin. `user_roles` has NO insert/update/delete policy
--     for anon/authenticated at all: every write goes through the service
--     role, only ever reached from server code that has already verified the
--     caller is an authenticated admin (see app/lib/supabase/roles.ts).
--   * RLS is enabled with zero client-facing policies on both new tables
--     (fully deny-by-default for anon/authenticated) -- server code always
--     reads/writes them with the service-role client after its own
--     authorization check, so no self-select policy is required either.
--   * `role` is a free-form `text` with a check constraint (not a Postgres
--     enum) so a future role (e.g. "moderator") is a one-line constraint
--     change, not a type migration.
--
-- Entirely additive/non-destructive: no table dropped or truncated, no
-- existing column altered destructively, every new column is nullable or has
-- a safe default. Safe to paste into the Supabase SQL Editor and run once.

-- ---------------------------------------------------------------------------
-- 1. user_roles
-- ---------------------------------------------------------------------------

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_user_id_key unique (user_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_roles_role_check'
      and conrelid = 'public.user_roles'::regclass
  ) then
    alter table public.user_roles
      add constraint user_roles_role_check check (role in ('user', 'admin'));
  end if;
end $$;

create index if not exists user_roles_role_idx on public.user_roles (role);

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

alter table public.user_roles enable row level security;
-- Deliberately no policies for anon/authenticated: only the service role
-- (which bypasses RLS) may read or write this table. A user can never see or
-- change even their own role row via the client.

-- ---------------------------------------------------------------------------
-- 2. is_admin() -- convenience SQL function for future RLS policies /
--    SECURITY DEFINER functions that need an admin check inside Postgres.
--    Not required by today's admin pages (they check role in TypeScript via
--    the service-role client -- see app/lib/supabase/roles.ts) but kept
--    available so a future policy or trigger doesn't have to duplicate this
--    logic. SECURITY DEFINER + a locked-down search_path so it can safely
--    read user_roles despite that table having no RLS policies of its own.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 3. admin_audit_logs -- durable record of privileged admin actions.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_admin_user_idx
  on public.admin_audit_logs (admin_user_id, created_at desc);
create index if not exists admin_audit_logs_entity_idx
  on public.admin_audit_logs (entity_type, entity_id);
create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;
-- Deliberately no policies for anon/authenticated: written and read only by
-- the service role, from server code that has already verified the caller is
-- an admin (see app/lib/data/adminAudit.ts).

-- ---------------------------------------------------------------------------
-- 4. sources: a lightweight admin rejection flag, independent of
--    url_status (which reflects the automated reachability check).
--    "Admin rejected" means a human reviewer decided this URL is not a
--    legitimate official source for the entity it's attached to (e.g. it
--    resolved to the wrong program), which the automated checker can't infer
--    from HTTP status alone. A rejected source is excluded from "Healthy"
--    counts and from the Verified signal Match/Routes/University Detail read,
--    regardless of its url_status.
-- ---------------------------------------------------------------------------

alter table public.sources
  add column if not exists admin_rejected boolean not null default false,
  add column if not exists admin_rejected_at timestamptz,
  add column if not exists admin_rejected_by uuid references auth.users (id) on delete set null;

create index if not exists sources_admin_rejected_idx
  on public.sources (admin_rejected) where admin_rejected;

-- ---------------------------------------------------------------------------
-- 5. programs: review status for the candidate -> official source ->
--    extracted -> review -> verified pipeline (task brief item 11/12).
--    Reuses `verified_at` (already existed) as the terminal "verified" state
--    -- this only adds the one missing intermediate state the admin Program
--    Review queue needs: has an admin actively flagged this candidate as
--    needing another look (e.g. the extracted official_url turned out to be
--    wrong), as opposed to simply "not verified yet".
-- ---------------------------------------------------------------------------

alter table public.programs
  add column if not exists needs_review boolean not null default false;

-- ---------------------------------------------------------------------------
-- 6. RLS note: universities/programs/sources/change_events/community_reports
--    already only accept writes from the service role (see
--    20260825120100_row_level_security.sql, 20260826180000_..., and
--    20260826260000_community_v1.sql) -- no RLS change is needed for Part A's
--    "a normal user cannot alter canonical data" requirement here, since
--    every admin write in this app goes through the service-role client
--    (app/lib/supabase/admin.ts) only after app/lib/supabase/roles.ts's
--    requireAdmin() has verified the caller server-side. RLS stays enabled
--    everywhere it already was; nothing here disables it.
-- ---------------------------------------------------------------------------
