
-- ============================================================
-- Migration: 20260508232733_29d39e7e-8912-4437-8a07-2ad1c7d80c98.sql
-- ============================================================


-- ============ ENUM de papéis ============
create type public.app_role as enum ('owner', 'admin', 'lawyer', 'assistant');

-- ============ COMPANIES ============
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.companies enable row level security;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  active_company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ============ COMPANY MEMBERS ============
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);
alter table public.company_members enable row level security;

-- ============ USER ROLES (por empresa) ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, company_id, role)
);
alter table public.user_roles enable row level security;

-- ============ FUNÇÕES SECURITY DEFINER ============
create or replace function public.is_company_member(_user_id uuid, _company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where user_id = _user_id and company_id = _company_id
  );
$$;

create or replace function public.has_company_role(_user_id uuid, _company_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and company_id = _company_id and role = _role
  );
$$;

create or replace function public.has_any_company_role(_user_id uuid, _company_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and company_id = _company_id and role = any(_roles)
  );
$$;

-- ============ POLICIES: profiles ============
create policy "users can view own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

create policy "users can update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id);

create policy "users can insert own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

-- ============ POLICIES: companies ============
create policy "members can view their companies"
on public.companies for select to authenticated
using (public.is_company_member(auth.uid(), id));

create policy "authenticated can create companies"
on public.companies for insert to authenticated
with check (auth.uid() = created_by);

create policy "owners and admins can update company"
on public.companies for update to authenticated
using (public.has_any_company_role(auth.uid(), id, array['owner','admin']::public.app_role[]));

create policy "owners can delete company"
on public.companies for delete to authenticated
using (public.has_company_role(auth.uid(), id, 'owner'));

-- ============ POLICIES: company_members ============
create policy "members can view membership of their companies"
on public.company_members for select to authenticated
using (public.is_company_member(auth.uid(), company_id));

create policy "owners and admins can add members"
on public.company_members for insert to authenticated
with check (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::public.app_role[]));

create policy "owners and admins can remove members"
on public.company_members for delete to authenticated
using (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::public.app_role[]));

-- ============ POLICIES: user_roles ============
create policy "users can view roles of their companies"
on public.user_roles for select to authenticated
using (public.is_company_member(auth.uid(), company_id));

create policy "owners and admins can assign roles"
on public.user_roles for insert to authenticated
with check (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::public.app_role[]));

create policy "owners and admins can remove roles"
on public.user_roles for delete to authenticated
using (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::public.app_role[]));

-- ============ TRIGGER: novo usuário ⇒ perfil + empresa pessoal ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _company_id uuid;
  _full_name text;
  _company_name text;
begin
  _full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  _company_name := coalesce(new.raw_user_meta_data->>'company_name', _full_name || ' - Escritório');

  insert into public.companies (name, created_by)
  values (_company_name, new.id)
  returning id into _company_id;

  insert into public.company_members (company_id, user_id)
  values (_company_id, new.id);

  insert into public.user_roles (user_id, company_id, role)
  values (new.id, _company_id, 'owner');

  insert into public.profiles (id, full_name, active_company_id)
  values (new.id, _full_name, _company_id);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ TRIGGER: updated_at ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_companies_updated before update on public.companies
for each row execute function public.touch_updated_at();
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.touch_updated_at();



-- ============================================================
-- Migration: 20260508232753_fb03baac-8eda-44dd-93ec-1f497bf56312.sql
-- ============================================================


-- Set search_path on touch_updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

-- Revoke execute from anon/authenticated on internal SECURITY DEFINER helpers
revoke execute on function public.is_company_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.has_company_role(uuid, uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.has_any_company_role(uuid, uuid, public.app_role[]) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;



-- ============================================================
-- Migration: 20260508235706_b8cd3a57-941f-4472-a289-4623ca2a289a.sql
-- ============================================================

-- Enums
create type public.client_type as enum ('individual', 'company');
create type public.case_status as enum ('active', 'paused', 'archived', 'won', 'lost', 'settled');
create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.event_type as enum ('hearing', 'meeting', 'deadline', 'other');

-- ============ CLIENTS ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  client_type public.client_type not null default 'individual',
  document text,
  email text,
  phone text,
  address text,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_company_idx on public.clients(company_id);
alter table public.clients enable row level security;

create policy "members can view clients" on public.clients
  for select to authenticated using (public.is_company_member(auth.uid(), company_id));
create policy "members can create clients" on public.clients
  for insert to authenticated with check (public.is_company_member(auth.uid(), company_id) and auth.uid() = created_by);
create policy "owners and admins can update clients" on public.clients
  for update to authenticated using (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::app_role[]));
create policy "owners and admins can delete clients" on public.clients
  for delete to authenticated using (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::app_role[]));

create trigger clients_touch_updated_at before update on public.clients
  for each row execute function public.touch_updated_at();

-- ============ CASES ============
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  assigned_to uuid,
  cnj_number text,
  title text not null,
  practice_area text,
  court text,
  phase text,
  status public.case_status not null default 'active',
  case_value numeric(14,2),
  description text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_company_idx on public.cases(company_id);
create index cases_client_idx on public.cases(client_id);
create index cases_assigned_idx on public.cases(assigned_to);
alter table public.cases enable row level security;

create policy "members can view cases" on public.cases
  for select to authenticated using (public.is_company_member(auth.uid(), company_id));
create policy "members can create cases" on public.cases
  for insert to authenticated with check (public.is_company_member(auth.uid(), company_id) and auth.uid() = created_by);
create policy "owners and admins can update cases" on public.cases
  for update to authenticated using (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::app_role[]));
create policy "owners and admins can delete cases" on public.cases
  for delete to authenticated using (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::app_role[]));

create trigger cases_touch_updated_at before update on public.cases
  for each row execute function public.touch_updated_at();

-- ============ TASKS ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  assigned_to uuid,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date timestamptz,
  completed_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_company_idx on public.tasks(company_id);
create index tasks_case_idx on public.tasks(case_id);
create index tasks_assigned_idx on public.tasks(assigned_to);
create index tasks_due_idx on public.tasks(due_date);
alter table public.tasks enable row level security;

create policy "members can view tasks" on public.tasks
  for select to authenticated using (public.is_company_member(auth.uid(), company_id));
create policy "members can create tasks" on public.tasks
  for insert to authenticated with check (public.is_company_member(auth.uid(), company_id) and auth.uid() = created_by);
create policy "members can update tasks" on public.tasks
  for update to authenticated using (public.is_company_member(auth.uid(), company_id));
create policy "owners and admins can delete tasks" on public.tasks
  for delete to authenticated using (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::app_role[]));

create trigger tasks_touch_updated_at before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ============ EVENTS ============
create table public.events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  assigned_to uuid,
  title text not null,
  description text,
  event_type public.event_type not null default 'meeting',
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_company_idx on public.events(company_id);
create index events_starts_idx on public.events(starts_at);
create index events_case_idx on public.events(case_id);
alter table public.events enable row level security;

create policy "members can view events" on public.events
  for select to authenticated using (public.is_company_member(auth.uid(), company_id));
create policy "members can create events" on public.events
  for insert to authenticated with check (public.is_company_member(auth.uid(), company_id) and auth.uid() = created_by);
create policy "members can update events" on public.events
  for update to authenticated using (public.is_company_member(auth.uid(), company_id));
create policy "owners and admins can delete events" on public.events
  for delete to authenticated using (public.has_any_company_role(auth.uid(), company_id, array['owner','admin']::app_role[]));

create trigger events_touch_updated_at before update on public.events
  for each row execute function public.touch_updated_at();



-- ============================================================
-- Migration: 20260509000754_77a9e93f-d75b-403c-bf72-daf5966273e4.sql
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS tasks_status_position_idx ON public.tasks (company_id, status, position);
CREATE INDEX IF NOT EXISTS tasks_client_id_idx ON public.tasks (client_id);



-- ============================================================
-- Migration: 20260509143726_bd3541d0-85e8-4665-a2a6-5dd1c50841fa.sql
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_company_role(uuid, uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_company_role(uuid, uuid, public.app_role) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_client_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_client_id_fkey FOREIGN KEY (client_id)
      REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_case_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_case_id_fkey FOREIGN KEY (case_id)
      REFERENCES public.cases(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assigned_to_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to)
      REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;



-- ============================================================
-- Migration: 20260509190833_e244fbcd-9dd6-4b9c-bc6e-e3dd3e56a5b9.sql
-- ============================================================

-- Lock down SECURITY DEFINER helper functions: only the database itself (used inside policies) should call them.
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_company_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_company_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;

-- Performance indexes for the most common task queries (dashboard list, kanban, activities)
CREATE INDEX IF NOT EXISTS idx_tasks_company_created_at ON public.tasks (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_company_status     ON public.tasks (company_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date           ON public.tasks (due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to        ON public.tasks (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_company_starts_at ON public.events (company_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_cases_company_id         ON public.cases (company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_id       ON public.clients (company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user     ON public.company_members (user_id);



-- ============================================================
-- Migration: 20260513165730_badd7afc-a0b4-40f6-9d4b-cffbf58a5e58.sql
-- ============================================================

-- Profile: OAB
alter table public.profiles
  add column if not exists oab_number text,
  add column if not exists oab_state text;

-- Publications
create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  created_by uuid not null,

  process_number text,
  process_subject text,
  court text,
  court_branch text,
  diary text,

  publication_date date,
  availability_date date,
  communication_type text,

  lawyer_name text,
  oab_number text,
  oab_state text,

  client_name text,
  client_id uuid,
  case_id uuid,

  content text,
  status text not null default 'not_handled',
  handled_at timestamptz,
  handled_by uuid,

  external_id text,
  source text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publications_company_idx on public.publications(company_id);
create index if not exists publications_status_idx on public.publications(company_id, status);
create index if not exists publications_pubdate_idx on public.publications(company_id, publication_date desc);
create unique index if not exists publications_external_uniq
  on public.publications(company_id, source, external_id)
  where external_id is not null;

alter table public.publications enable row level security;

create policy "members can view publications"
  on public.publications for select to authenticated
  using (is_company_member(auth.uid(), company_id));

create policy "members can create publications"
  on public.publications for insert to authenticated
  with check (is_company_member(auth.uid(), company_id) and auth.uid() = created_by);

create policy "members can update publications"
  on public.publications for update to authenticated
  using (is_company_member(auth.uid(), company_id));

create policy "owners and admins can delete publications"
  on public.publications for delete to authenticated
  using (has_any_company_role(auth.uid(), company_id, array['owner'::app_role, 'admin'::app_role]));

create trigger publications_touch_updated_at
  before update on public.publications
  for each row execute function public.touch_updated_at();

-- Deadlines
create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  created_by uuid not null,
  publication_id uuid references public.publications(id) on delete cascade,
  case_id uuid,
  assigned_to uuid,

  title text not null,
  description text,
  due_date date not null,
  status text not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deadlines_company_idx on public.deadlines(company_id);
create index if not exists deadlines_due_idx on public.deadlines(company_id, due_date);
create index if not exists deadlines_publication_idx on public.deadlines(publication_id);

alter table public.deadlines enable row level security;

create policy "members can view deadlines"
  on public.deadlines for select to authenticated
  using (is_company_member(auth.uid(), company_id));

create policy "members can create deadlines"
  on public.deadlines for insert to authenticated
  with check (is_company_member(auth.uid(), company_id) and auth.uid() = created_by);

create policy "members can update deadlines"
  on public.deadlines for update to authenticated
  using (is_company_member(auth.uid(), company_id));

create policy "owners and admins can delete deadlines"
  on public.deadlines for delete to authenticated
  using (has_any_company_role(auth.uid(), company_id, array['owner'::app_role, 'admin'::app_role]));

create trigger deadlines_touch_updated_at
  before update on public.deadlines
  for each row execute function public.touch_updated_at();

-- Realtime
alter publication supabase_realtime add table public.publications;
alter publication supabase_realtime add table public.deadlines;



-- ============================================================
-- Migration: 20260513181729_1ad5ca15-250f-4518-885e-67ac1af13620.sql
-- ============================================================

ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS ai_analysis jsonb;



-- ============================================================
-- Migration: 20260513182606_87f6b0f7-53b4-4c90-a5dc-3fc761b4ac37.sql
-- ============================================================

ALTER TABLE public.deadlines
  ADD COLUMN IF NOT EXISTS is_double_term boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_alert_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_alert_level text;

CREATE INDEX IF NOT EXISTS idx_deadlines_due_date_status
  ON public.deadlines (company_id, status, due_date);



-- ============================================================
-- Migration: 20260513184450_1bd0bf8f-630c-43af-96cb-da693ddb0efd.sql
-- ============================================================


-- 1) assigned_to em publications
ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

CREATE INDEX IF NOT EXISTS publications_assigned_to_idx
  ON public.publications(assigned_to);

-- 2) tabela de comentários internos
CREATE TABLE IF NOT EXISTS public.publication_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  publication_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publication_comments_pub_idx
  ON public.publication_comments(publication_id, created_at DESC);

ALTER TABLE public.publication_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view publication comments"
  ON public.publication_comments
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create publication comments"
  ON public.publication_comments
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = author_id);

CREATE POLICY "authors can update own comments"
  ON public.publication_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "authors or admins can delete comments"
  ON public.publication_comments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role])
  );

CREATE TRIGGER publication_comments_updated_at
  BEFORE UPDATE ON public.publication_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) realtime para comentários
ALTER PUBLICATION supabase_realtime ADD TABLE public.publication_comments;



-- ============================================================
-- Migration: 20260513184551_0aef9962-c047-48fe-ab65-d9387fee6297.sql
-- ============================================================


CREATE OR REPLACE FUNCTION public.shares_company_with(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members ma
    JOIN public.company_members mb ON mb.company_id = ma.company_id
    WHERE ma.user_id = _a AND mb.user_id = _b
  );
$$;

CREATE POLICY "members can view colleagues profiles"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (public.shares_company_with(auth.uid(), id));



-- ============================================================
-- Migration: 20260513184611_5b2817c2-259d-4727-9e00-d16cd0c98282.sql
-- ============================================================


REVOKE EXECUTE ON FUNCTION public.shares_company_with(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_company_with(uuid, uuid) TO authenticated;



-- ============================================================
-- Migration: 20260513185816_93aa9a05-c1cc-4577-ad68-262f818b6d40.sql
-- ============================================================


-- 1) OABs monitoradas
CREATE TABLE IF NOT EXISTS public.oab_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  oab_number text NOT NULL,
  oab_state text NOT NULL,
  label text,
  active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, oab_number, oab_state)
);

CREATE INDEX IF NOT EXISTS oab_monitors_company_idx
  ON public.oab_monitors(company_id);

ALTER TABLE public.oab_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view oab monitors"
  ON public.oab_monitors FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create oab monitors"
  ON public.oab_monitors FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "members can update oab monitors"
  ON public.oab_monitors FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners and admins can delete oab monitors"
  ON public.oab_monitors FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER oab_monitors_updated_at
  BEFORE UPDATE ON public.oab_monitors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Histórico de sincronizações
CREATE TABLE IF NOT EXISTS public.publication_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  source text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'manual',
  oab_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS publication_sync_logs_company_idx
  ON public.publication_sync_logs(company_id, started_at DESC);

ALTER TABLE public.publication_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view sync logs"
  ON public.publication_sync_logs FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

-- inserts são feitos pelo server (service role bypassa RLS)

-- 3) Notificações in-app
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- inserts feitos pelo server (service role)

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.publication_sync_logs;



-- ============================================================
-- Migration: 20260513191431_8701ec15-3a4a-484e-b5f5-5ac7262ba012.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;



-- ============================================================
-- Migration: 20260513194746_7bf355ed-1b53-4264-899a-0448352f239b.sql
-- ============================================================

-- Reagenda cron jobs para passar o apikey header (publishable key)
-- exigido pelos hooks /api/public/hooks/* após hardening de segurança.

DO $$
DECLARE
  v_apikey TEXT := 'REPLACE_WITH_SUPABASE_PUBLISHABLE_KEY';
  v_base TEXT := 'https://project--9f1f5e48-03fc-4442-907a-a1a9a18cd0b8.lovable.app';
  v_headers JSONB;
BEGIN
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', v_apikey
  );

  -- Remove agendamentos antigos (sem apikey) se existirem
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'jusbrasil-sync-daily',
    'deadline-alerts-hourly',
    'weekly-report-monday'
  );

  PERFORM cron.schedule(
    'jusbrasil-sync-daily',
    '0 7 * * 1-5',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $f$, v_base || '/api/public/hooks/run-jusbrasil-sync', v_headers::text)
  );

  PERFORM cron.schedule(
    'deadline-alerts-hourly',
    '0 * * * *',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $f$, v_base || '/api/public/hooks/run-deadline-alerts', v_headers::text)
  );

  PERFORM cron.schedule(
    'weekly-report-monday',
    '0 8 * * 1',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $f$, v_base || '/api/public/hooks/run-weekly-report', v_headers::text)
  );
END
$$;



-- ============================================================
-- Migration: 20260514121233_433a6ade-83e6-4259-af29-ecc48d2cf78a.sql
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_company_role(uuid, uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_company_role(uuid, uuid, public.app_role) TO authenticated;



-- ============================================================
-- Migration: 20260514173938_3d64494c-5b39-4ad8-a79d-af60a85c956f.sql
-- ============================================================

-- Tabela de processos monitorados via DataJud
CREATE TABLE public.monitored_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  cnj_number text NOT NULL,
  tribunal_alias text NOT NULL,
  label text,
  client_id uuid,
  case_id uuid,
  active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_movement_date date,
  movements_count integer NOT NULL DEFAULT 0,
  classe text,
  assunto text,
  orgao_julgador text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, cnj_number)
);

CREATE INDEX idx_monitored_processes_company ON public.monitored_processes(company_id);
CREATE INDEX idx_monitored_processes_active ON public.monitored_processes(active) WHERE active = true;

ALTER TABLE public.monitored_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view monitored processes"
  ON public.monitored_processes FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create monitored processes"
  ON public.monitored_processes FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "members can update monitored processes"
  ON public.monitored_processes FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners and admins can delete monitored processes"
  ON public.monitored_processes FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER touch_monitored_processes
  BEFORE UPDATE ON public.monitored_processes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Adicionar coluna para vincular publicação ao processo monitorado
ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS monitored_process_id uuid;

CREATE INDEX IF NOT EXISTS idx_publications_monitored_process
  ON public.publications(monitored_process_id);



-- ============================================================
-- Migration: 20260514174511_513edb2f-e02c-42e0-8c8c-51d6936d5856.sql
-- ============================================================


CREATE POLICY "members can insert sync logs"
ON public.publication_sync_logs
FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can update sync logs"
ON public.publication_sync_logs
FOR UPDATE TO authenticated
USING (is_company_member(auth.uid(), company_id));



-- ============================================================
-- Migration: 20260515151011_04d2c61b-b609-425f-8cfd-29a8ec65a784.sql
-- ============================================================

DROP TABLE IF EXISTS public.publication_sync_logs CASCADE;
DROP TABLE IF EXISTS public.monitored_processes CASCADE;
DROP TABLE IF EXISTS public.oab_monitors CASCADE;

ALTER TABLE public.publications
  DROP COLUMN IF EXISTS monitored_process_id,
  DROP COLUMN IF EXISTS external_id,
  DROP COLUMN IF EXISTS source;



-- ============================================================
-- Migration: 20260515160904_070eb8b0-a844-4f87-accd-bc3be458bdf2.sql
-- ============================================================

CREATE TABLE public.triagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  raw_description text NOT NULL,
  ai_classification jsonb,
  status text NOT NULL DEFAULT 'novo',
  converted_client_id uuid,
  converted_case_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.triagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view triagens"
  ON public.triagens FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create triagens"
  ON public.triagens FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "members can update triagens"
  ON public.triagens FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners and admins can delete triagens"
  ON public.triagens FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER triagens_touch_updated_at
  BEFORE UPDATE ON public.triagens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_triagens_company_created ON public.triagens (company_id, created_at DESC);



-- ============================================================
-- Migration: 20260515174038_aa783478-7607-4db1-82d4-6056afa4b62e.sql
-- ============================================================


CREATE TABLE public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('receita','despesa','honorario')),
  category text,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  due_date date,
  paid_at date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  payment_method text,
  case_id uuid,
  client_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fe_company ON public.financial_entries(company_id);
CREATE INDEX idx_fe_due ON public.financial_entries(company_id, due_date);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view financial_entries" ON public.financial_entries
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create financial_entries" ON public.financial_entries
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "members can update financial_entries" ON public.financial_entries
  FOR UPDATE TO authenticated USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners admins delete financial_entries" ON public.financial_entries
  FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_fe_updated_at BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();



-- ============================================================
-- Migration: 20260515175721_f3ae0662-2e21-4047-84c6-3f0569297304.sql
-- ============================================================

CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'honorarios',
  client_id UUID,
  case_id UUID,
  counterparty TEXT,
  value NUMERIC,
  payment_terms TEXT,
  start_date DATE,
  end_date DATE,
  signed_at DATE,
  status TEXT NOT NULL DEFAULT 'rascunho',
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create contracts" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "owners admins update contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "owners admins delete contracts" ON public.contracts
  FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER contracts_set_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_contracts_company ON public.contracts(company_id);
CREATE INDEX idx_contracts_client ON public.contracts(client_id);



-- ============================================================
-- Migration: 20260515175950_0dde97e3-a59a-4ee1-ac24-601b28c7c966.sql
-- ============================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';



-- ============================================================
-- Migration: 20260515181625_55c1f066-4e20-4883-bbf7-6dc062bc3231.sql
-- ============================================================

-- Documents table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  case_id uuid,
  name text NOT NULL,
  description text,
  category text,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_company ON public.documents(company_id);
CREATE INDEX idx_documents_client ON public.documents(client_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view documents"
ON public.documents FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can insert documents"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id) AND uploaded_by = auth.uid());

CREATE POLICY "Members can update documents"
ON public.documents FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Owners/admins can delete documents"
ON public.documents FOR DELETE TO authenticated
USING (public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path is "<company_id>/<uuid>-<filename>"
CREATE POLICY "Members can read company documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can upload company documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can update company documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Owners/admins can delete company documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.has_any_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner','admin']::app_role[])
);



-- ============================================================
-- Migration: 20260515212605_57d04d0f-0e84-48e1-b575-fce079664c19.sql
-- ============================================================


CREATE TYPE public.atendimento_status AS ENUM ('agendado', 'em_andamento', 'concluido', 'cancelado');
CREATE TYPE public.atendimento_channel AS ENUM ('presencial', 'video', 'telefone', 'whatsapp', 'email');

CREATE TABLE public.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  assigned_to UUID,
  subject TEXT NOT NULL,
  summary TEXT,
  channel public.atendimento_channel NOT NULL DEFAULT 'presencial',
  status public.atendimento_status NOT NULL DEFAULT 'agendado',
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  billable BOOLEAN NOT NULL DEFAULT false,
  hourly_rate NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atendimentos_company ON public.atendimentos(company_id);
CREATE INDEX idx_atendimentos_client ON public.atendimentos(client_id);
CREATE INDEX idx_atendimentos_case ON public.atendimentos(case_id);
CREATE INDEX idx_atendimentos_scheduled ON public.atendimentos(scheduled_at);

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view atendimentos"
  ON public.atendimentos FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members can insert atendimentos"
  ON public.atendimentos FOR INSERT
  WITH CHECK (public.is_company_member(auth.uid(), company_id) AND created_by = auth.uid());

CREATE POLICY "members can update atendimentos"
  ON public.atendimentos FOR UPDATE
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members can delete atendimentos"
  ON public.atendimentos FOR DELETE
  USING (public.is_company_member(auth.uid(), company_id));

CREATE OR REPLACE FUNCTION public.set_atendimentos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_atendimentos_updated_at
  BEFORE UPDATE ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_atendimentos_updated_at();



-- ============================================================
-- Migration: 20260515213350_bbd891c4-7754-4d0f-bdcd-0b3c12daf3fb.sql
-- ============================================================

-- Support tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  response text,
  responded_by uuid,
  responded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_company ON public.support_tickets(company_id, created_at DESC);
CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "owners and admins can view company tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "members can create own tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = user_id);

CREATE POLICY "owners and admins can update tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "owners and admins can delete tickets"
ON public.support_tickets FOR DELETE TO authenticated
USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();



-- ============================================================
-- Migration: 20260516122341_136f736a-4659-4bb8-90f6-1a2babe616bf.sql
-- ============================================================


-- ============ TABELA PRINCIPAL: production_cards ============
CREATE TABLE public.production_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  assignee_id uuid NOT NULL,
  created_by uuid NOT NULL,
  client_id uuid,
  case_id uuid,
  client_name_snapshot text,
  process_number text,
  practice_area text,
  demand_type text,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','urgente')),
  column_key text NOT NULL DEFAULT 'para_producao' CHECK (column_key IN (
    'para_producao','para_protocolo_judicial','protocolados_adm','intermediarias',
    'arquivados','concluidos','em_revisao','pendencias'
  )),
  status_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_date timestamptz,
  sla_hours integer,
  started_at timestamptz,
  completed_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pc_company ON public.production_cards(company_id);
CREATE INDEX idx_pc_assignee ON public.production_cards(assignee_id);
CREATE INDEX idx_pc_column ON public.production_cards(company_id, assignee_id, column_key, position);
CREATE INDEX idx_pc_client ON public.production_cards(client_id);
CREATE INDEX idx_pc_case ON public.production_cards(case_id);

ALTER TABLE public.production_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view production_cards" ON public.production_cards
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members can create production_cards" ON public.production_cards
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);
CREATE POLICY "members can update production_cards" ON public.production_cards
  FOR UPDATE TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "owners admins delete production_cards" ON public.production_cards
  FOR DELETE TO authenticated USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_pc_updated_at BEFORE UPDATE ON public.production_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EVENTOS / TIMELINE ============
CREATE TABLE public.production_card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.production_cards(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pce_card ON public.production_card_events(card_id, created_at DESC);
ALTER TABLE public.production_card_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view production_card_events" ON public.production_card_events
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members can create production_card_events" ON public.production_card_events
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = actor_id);

-- ============ COMENTÁRIOS ============
CREATE TABLE public.production_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.production_cards(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pcc_card ON public.production_card_comments(card_id, created_at DESC);
ALTER TABLE public.production_card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view production_card_comments" ON public.production_card_comments
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members can create production_card_comments" ON public.production_card_comments
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = author_id);
CREATE POLICY "authors update own comments" ON public.production_card_comments
  FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "authors or admins delete comments" ON public.production_card_comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id OR has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_pcc_updated_at BEFORE UPDATE ON public.production_card_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CHECKLIST ============
CREATE TABLE public.production_card_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.production_cards(id) ON DELETE CASCADE,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pck_card ON public.production_card_checklist(card_id, position);
ALTER TABLE public.production_card_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view checklist" ON public.production_card_checklist
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members insert checklist" ON public.production_card_checklist
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "members update checklist" ON public.production_card_checklist
  FOR UPDATE TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members delete checklist" ON public.production_card_checklist
  FOR DELETE TO authenticated USING (is_company_member(auth.uid(), company_id));

-- ============ WATCHERS ============
CREATE TABLE public.production_card_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.production_cards(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id, profile_id)
);
ALTER TABLE public.production_card_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view watchers" ON public.production_card_watchers
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members insert watchers" ON public.production_card_watchers
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "members delete watchers" ON public.production_card_watchers
  FOR DELETE TO authenticated USING (is_company_member(auth.uid(), company_id));

-- ============ DOCUMENTS: vínculo com card ============
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS card_id uuid;
CREATE INDEX IF NOT EXISTS idx_documents_card_id ON public.documents(card_id);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_events;
ALTER TABLE public.production_cards REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_events REPLICA IDENTITY FULL;



-- ============================================================
-- Migration: 20260516124107_ff512bd7-9a9c-4be7-9eb1-c9b202d659b4.sql
-- ============================================================


-- Realtime: emit full row data on updates
ALTER TABLE public.production_cards REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_comments REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_checklist REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_events REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_watchers REPLICA IDENTITY FULL;

-- Add to realtime publication (ignore if already added)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_cards; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_checklist; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_watchers; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Storage policies for the existing 'documents' bucket, scoped per company folder
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='members can view company documents') THEN
    CREATE POLICY "members can view company documents"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'documents'
        AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='members can upload company documents') THEN
    CREATE POLICY "members can upload company documents"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'documents'
        AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='members can delete company documents') THEN
    CREATE POLICY "members can delete company documents"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'documents'
        AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      );
  END IF;
END $$;



-- ============================================================
-- Migration: 20260516124415_5f068c6a-c2ce-4d42-925b-7944c62d2ee2.sql
-- ============================================================


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications'
      AND policyname='members can insert notifications for colleagues'
  ) THEN
    CREATE POLICY "members can insert notifications for colleagues"
      ON public.notifications FOR INSERT TO authenticated
      WITH CHECK (
        is_company_member(auth.uid(), company_id)
        AND is_company_member(user_id, company_id)
      );
  END IF;
END $$;



-- ============================================================
-- Migration: 20260516131033_da74f288-80a4-415e-8239-e1d1ed592f77.sql
-- ============================================================

-- ============================================================
-- Security hardening: Realtime authorization + RLS role fixes
-- ============================================================

-- 1) Realtime authorization
-- Restrict who can subscribe to realtime channels.
-- Currently the only topic in use is `agenda-<companyId>`.
-- Anyone authenticated may only receive messages on topics that
-- match a company they belong to.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated company members can read realtime" ON realtime.messages;
CREATE POLICY "authenticated company members can read realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'agenda-%' THEN
      public.is_company_member(
        auth.uid(),
        NULLIF(substring(realtime.topic() FROM 'agenda-(.*)$'), '')::uuid
      )
    ELSE false
  END
);

DROP POLICY IF EXISTS "authenticated company members can broadcast" ON realtime.messages;
CREATE POLICY "authenticated company members can broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'agenda-%' THEN
      public.is_company_member(
        auth.uid(),
        NULLIF(substring(realtime.topic() FROM 'agenda-(.*)$'), '')::uuid
      )
    ELSE false
  END
);

-- 2) atendimentos policies: restrict to authenticated role only
DROP POLICY IF EXISTS "members can view atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "members can insert atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "members can update atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "members can delete atendimentos" ON public.atendimentos;

CREATE POLICY "members can view atendimentos"
ON public.atendimentos FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members can insert atendimentos"
ON public.atendimentos FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id) AND created_by = auth.uid());

CREATE POLICY "members can update atendimentos"
ON public.atendimentos FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members can delete atendimentos"
ON public.atendimentos FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

-- 3) Revoke EXECUTE from anon/public on SECURITY DEFINER helpers
--    (they are RLS helpers and only need to be callable by authenticated users)
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_company_role(uuid, uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_any_company_role(uuid, uuid, public.app_role[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.shares_company_with(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_company_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_company_role(uuid, uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_company_with(uuid, uuid) TO authenticated;



-- ============================================================
-- Migration: 20260517113229_48a85d57-b8a7-4ab2-9f11-98cfe4b2a279.sql
-- ============================================================

-- Triagens: novos campos previdenciários
ALTER TABLE public.triagens
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS practice_area text,
  ADD COLUMN IF NOT EXISTS benefit_type text,
  ADD COLUMN IF NOT EXISTS gov_password text,
  ADD COLUMN IF NOT EXISTS inss_password text,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- Clients: campos do cadastro definitivo + flag de provisório
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_provisional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS city text;

-- Production cards: vinculo com triagem + questionário previdenciário
ALTER TABLE public.production_cards
  ADD COLUMN IF NOT EXISTS triagem_id uuid,
  ADD COLUMN IF NOT EXISTS questionnaire jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_production_cards_triagem ON public.production_cards(triagem_id);
CREATE INDEX IF NOT EXISTS idx_clients_provisional ON public.clients(company_id, is_provisional);



-- ============================================================
-- Migration: 20260517114310_2f668fc5-a1f5-45c4-9783-4fd3687ca6b8.sql
-- ============================================================

-- Bucket público para fotos de clientes
insert into storage.buckets (id, name, public)
values ('client-photos', 'client-photos', true)
on conflict (id) do nothing;

-- Leitura pública
create policy "Public can view client photos"
on storage.objects for select
using (bucket_id = 'client-photos');

-- Membros podem subir fotos (pasta = company_id)
create policy "Members can upload client photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-photos'
  and is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Membros podem atualizar
create policy "Members can update client photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-photos'
  and is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Owners/admins podem deletar
create policy "Owners/admins can delete client photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-photos'
  and has_any_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::app_role,'admin'::app_role])
);



-- ============================================================
-- Migration: 20260517115019_3bb97c81-82d4-4ddf-8bf8-8d3307f2fd50.sql
-- ============================================================

ALTER TABLE public.production_cards DROP CONSTRAINT production_cards_column_key_check;
ALTER TABLE public.production_cards ADD CONSTRAINT production_cards_column_key_check CHECK (column_key = ANY (ARRAY['pre_atendimento'::text,'para_producao'::text,'para_protocolo_judicial'::text,'protocolados_adm'::text,'intermediarias'::text,'arquivados'::text,'concluidos'::text,'em_revisao'::text,'pendencias'::text,'contrato_fechado'::text]));



-- ============================================================
-- Migration: 20260518135952_92dc6fe2-80a7-4c50-9e49-7d600db09e96.sql
-- ============================================================

CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_company_created ON public.activity_logs (company_id, created_at DESC);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view activity_logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members can insert activity_logs"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id) AND user_id = auth.uid());



-- ============================================================
-- Migration: 20260518142246_a74f4300-42bc-4e49-9f62-2c19f36f94c3.sql
-- ============================================================

-- Vínculo contrato -> processo
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS case_id uuid;

CREATE INDEX IF NOT EXISTS idx_contracts_case_id ON public.contracts(case_id);

-- Andamentos processuais
CREATE TABLE IF NOT EXISTS public.process_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  case_id uuid NOT NULL,
  created_by uuid NOT NULL,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  movement_type text NOT NULL DEFAULT 'andamento',
  title text NOT NULL,
  description text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_movements_case ON public.process_movements(case_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_process_movements_company ON public.process_movements(company_id, created_at DESC);

ALTER TABLE public.process_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view process_movements"
  ON public.process_movements FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members insert process_movements"
  ON public.process_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id) AND created_by = auth.uid());

CREATE POLICY "members update process_movements"
  ON public.process_movements FOR UPDATE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "owners admins delete process_movements"
  ON public.process_movements FOR DELETE TO authenticated
  USING (public.has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER trg_process_movements_updated
  BEFORE UPDATE ON public.process_movements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();



-- ============================================================
-- Migration: 20260518144810_ee926a34-5031-462c-a85b-a43c27a24fbf.sql
-- ============================================================

ALTER TABLE public.production_cards
  ADD COLUMN IF NOT EXISTS legal_phase text NOT NULL DEFAULT 'triagem',
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'aguardando_documentos',
  ADD COLUMN IF NOT EXISTS legal_phase_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS operational_status_changed_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_pc_company_legal_phase ON public.production_cards (company_id, legal_phase);
CREATE INDEX IF NOT EXISTS idx_pc_company_op_status ON public.production_cards (company_id, operational_status);

UPDATE public.production_cards SET legal_phase = CASE column_key
  WHEN 'pre_atendimento' THEN 'triagem'
  WHEN 'contrato_fechado' THEN 'contrato_fechado'
  WHEN 'peticao_inicial' THEN 'peticao_inicial'
  WHEN 'citacao' THEN 'citacao'
  WHEN 'contestacao' THEN 'contestacao'
  WHEN 'instrucao' THEN 'instrucao'
  WHEN 'sentenca' THEN 'sentenca'
  WHEN 'recurso' THEN 'recurso'
  WHEN 'execucao' THEN 'execucao'
  WHEN 'arquivado' THEN 'arquivado'
  ELSE 'triagem'
END
WHERE legal_phase = 'triagem';

UPDATE public.production_cards SET operational_status = CASE column_key
  WHEN 'para_producao' THEN 'em_analise'
  WHEN 'em_producao' THEN 'em_producao'
  WHEN 'em_revisao' THEN 'em_revisao'
  WHEN 'protocolado' THEN 'protocolado'
  WHEN 'acompanhamento' THEN 'acompanhamento'
  WHEN 'pendencias' THEN 'pendencias'
  WHEN 'finalizado' THEN 'finalizado'
  ELSE 'aguardando_documentos'
END
WHERE operational_status = 'aguardando_documentos';

CREATE TABLE IF NOT EXISTS public.card_phase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  track text NOT NULL CHECK (track IN ('legal','operational')),
  from_value text,
  to_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cph_card ON public.card_phase_history (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cph_company ON public.card_phase_history (company_id, created_at DESC);

ALTER TABLE public.card_phase_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view card_phase_history" ON public.card_phase_history;
CREATE POLICY "members view card_phase_history"
  ON public.card_phase_history FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "members insert card_phase_history" ON public.card_phase_history;
CREATE POLICY "members insert card_phase_history"
  ON public.card_phase_history FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND actor_id = auth.uid());



-- ============================================================
-- Migration: 20260518150251_090bebd0-969c-4c95-8bc2-8f64f2f835ac.sql
-- ============================================================


-- Expand status enum
ALTER TYPE public.atendimento_status ADD VALUE IF NOT EXISTS 'confirmado';
ALTER TYPE public.atendimento_status ADD VALUE IF NOT EXISTS 'em_atendimento';
ALTER TYPE public.atendimento_status ADD VALUE IF NOT EXISTS 'aguardando_retorno';
ALTER TYPE public.atendimento_status ADD VALUE IF NOT EXISTS 'nao_compareceu';

-- New columns on atendimentos
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS consultation_type text NOT NULL DEFAULT 'consulta_inicial',
  ADD COLUMN IF NOT EXISTS fee_schedule_id uuid,
  ADD COLUMN IF NOT EXISTS amount numeric;

-- Fee schedule table
CREATE TABLE IF NOT EXISTS public.fee_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  service_type text NOT NULL,
  description text,
  default_amount numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view fee_schedule" ON public.fee_schedule
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members insert fee_schedule" ON public.fee_schedule
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND created_by = auth.uid());

CREATE POLICY "members update fee_schedule" ON public.fee_schedule
  FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners admins delete fee_schedule" ON public.fee_schedule
  FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER fee_schedule_touch_updated_at
  BEFORE UPDATE ON public.fee_schedule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();



-- ============================================================
-- Migration: 20260518150520_c8f7113c-8f87-493f-a354-1ebd7f9ea236.sql
-- ============================================================


-- DOCUMENTS: hierarchical structure
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS owner_member_id uuid;

CREATE INDEX IF NOT EXISTS idx_documents_scope_company ON public.documents(company_id, scope);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_case ON public.documents(case_id);

-- CASES: enriched fields
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS polo_ativo text,
  ADD COLUMN IF NOT EXISTS polo_passivo text,
  ADD COLUMN IF NOT EXISTS lawyer_id uuid,
  ADD COLUMN IF NOT EXISTS internal_number text,
  ADD COLUMN IF NOT EXISTS instance text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS procedural_status text,
  ADD COLUMN IF NOT EXISTS distribution_date date;

-- FINANCIAL ENTRIES: subtype for tabs
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS subtype text NOT NULL DEFAULT 'geral';
-- subtype examples: honorario, parcela, repasse, despesa_fixa, consulta, geral

CREATE INDEX IF NOT EXISTS idx_financial_entries_subtype ON public.financial_entries(company_id, subtype, status);
CREATE INDEX IF NOT EXISTS idx_financial_entries_due ON public.financial_entries(company_id, due_date);



-- ============================================================
-- Migration: 20260518170635_f70bb5ab-49d4-4498-948e-4d7147a04616.sql
-- ============================================================

UPDATE public.atendimentos SET status = 'em_atendimento' WHERE status = 'em_andamento';



-- ============================================================
-- Migration: 20260518180704_43efe76d-0de2-438a-b71f-3befc1f5768c.sql
-- ============================================================

-- Performance indexes on hot filter columns
CREATE INDEX IF NOT EXISTS idx_production_cards_company ON public.production_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_assignee ON public.production_cards(assignee_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_client ON public.production_cards(client_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_case ON public.production_cards(case_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_updated ON public.production_cards(company_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_cards_due ON public.production_cards(due_date);

CREATE INDEX IF NOT EXISTS idx_atendimentos_company ON public.atendimentos(company_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_client ON public.atendimentos(client_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_case ON public.atendimentos(case_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_assigned ON public.atendimentos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_atendimentos_scheduled ON public.atendimentos(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON public.atendimentos(company_id, status);

CREATE INDEX IF NOT EXISTS idx_cases_company ON public.cases(company_id);
CREATE INDEX IF NOT EXISTS idx_cases_client ON public.cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned ON public.cases(assigned_to);

CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(company_id, name);

CREATE INDEX IF NOT EXISTS idx_tasks_company ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_case ON public.tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_deadlines_company ON public.deadlines(company_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_case ON public.deadlines(case_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_due ON public.deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_assigned ON public.deadlines(assigned_to);

CREATE INDEX IF NOT EXISTS idx_events_company ON public.events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_starts ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_assigned ON public.events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_events_case ON public.events(case_id);

CREATE INDEX IF NOT EXISTS idx_financial_company ON public.financial_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_due ON public.financial_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_status ON public.financial_entries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_client ON public.financial_entries(client_id);

CREATE INDEX IF NOT EXISTS idx_publications_company ON public.publications(company_id);
CREATE INDEX IF NOT EXISTS idx_publications_status ON public.publications(company_id, status);
CREATE INDEX IF NOT EXISTS idx_publications_assigned ON public.publications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_publications_case ON public.publications(case_id);

CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_case ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_card ON public.documents(card_id);

CREATE INDEX IF NOT EXISTS idx_contracts_company ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON public.contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_case ON public.contracts(case_id);
CREATE INDEX IF NOT EXISTS idx_contracts_signed ON public.contracts(company_id, signed_at);

CREATE INDEX IF NOT EXISTS idx_triagens_company ON public.triagens(company_id);
CREATE INDEX IF NOT EXISTS idx_triagens_status ON public.triagens(company_id, status);
CREATE INDEX IF NOT EXISTS idx_triagens_assigned ON public.triagens(assigned_to);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON public.activity_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_card_phase_history_card ON public.card_phase_history(card_id);
CREATE INDEX IF NOT EXISTS idx_card_phase_history_company ON public.card_phase_history(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_process_movements_case ON public.process_movements(case_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_process_movements_company ON public.process_movements(company_id);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup ON public.user_roles(user_id, company_id, role);

-- Make client-photos bucket private (still accessible via signed URLs)
UPDATE storage.buckets SET public = false WHERE id = 'client-photos';

-- Storage policies for client-photos (members of company can read/write)
DROP POLICY IF EXISTS "client photos read" ON storage.objects;
DROP POLICY IF EXISTS "client photos write" ON storage.objects;
DROP POLICY IF EXISTS "client photos update" ON storage.objects;
DROP POLICY IF EXISTS "client photos delete" ON storage.objects;

CREATE POLICY "client photos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-photos');

CREATE POLICY "client photos write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-photos');

CREATE POLICY "client photos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-photos');

CREATE POLICY "client photos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-photos');



-- ============================================================
-- Migration: 20260518222157_00334ba0-2cdd-43e8-8d57-56763dfa6ea2.sql
-- ============================================================

-- BOARDS
CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  board_type text NOT NULL DEFAULT 'advogado',
  color text NOT NULL DEFAULT 'blue',
  gradient text,
  icon text,
  owner_id uuid,
  role_label text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view boards" ON public.boards
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members create boards" ON public.boards
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "creator or admins update boards" ON public.boards
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "creator or admins delete boards" ON public.boards
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER touch_boards_updated_at BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_boards_company ON public.boards(company_id);

-- BOARD COLUMNS
CREATE TABLE public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  key text NOT NULL,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view board_columns" ON public.board_columns
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members insert board_columns" ON public.board_columns
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "members update board_columns" ON public.board_columns
  FOR UPDATE TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members delete board_columns" ON public.board_columns
  FOR DELETE TO authenticated USING (is_company_member(auth.uid(), company_id));

CREATE INDEX idx_board_columns_board ON public.board_columns(board_id);

-- BOARD MEMBERS
CREATE TABLE public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view board_members" ON public.board_members
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members insert board_members" ON public.board_members
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "members delete board_members" ON public.board_members
  FOR DELETE TO authenticated USING (is_company_member(auth.uid(), company_id));

CREATE INDEX idx_board_members_board ON public.board_members(board_id);

-- LINK PRODUCTION CARDS TO BOARDS
ALTER TABLE public.production_cards ADD COLUMN board_id uuid REFERENCES public.boards(id) ON DELETE SET NULL;
CREATE INDEX idx_production_cards_board ON public.production_cards(board_id);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_members;



-- ============================================================
-- Migration: 20260519192343_c462b0a3-7a2f-4a1f-9051-3ce2b906c735.sql
-- ============================================================


CREATE TABLE public.member_board_columns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  owner_user_id uuid not null,
  key text not null,
  title text not null,
  color text not null default 'slate',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id, owner_user_id, key)
);

CREATE INDEX idx_member_board_columns_owner
  ON public.member_board_columns(company_id, owner_user_id, position);

ALTER TABLE public.member_board_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view member_board_columns"
  ON public.member_board_columns FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members insert member_board_columns"
  ON public.member_board_columns FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "members update member_board_columns"
  ON public.member_board_columns FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members delete member_board_columns"
  ON public.member_board_columns FOR DELETE TO authenticated
  USING (is_company_member(auth.uid(), company_id));



-- ============================================================
-- Migration: 20260519212947_73852e93-1ed4-4700-9b55-f5c54836c3e0.sql
-- ============================================================


-- Remove policies abertas/públicas
DROP POLICY IF EXISTS "Public can view client photos" ON storage.objects;
DROP POLICY IF EXISTS "client photos read" ON storage.objects;
DROP POLICY IF EXISTS "client photos write" ON storage.objects;
DROP POLICY IF EXISTS "client photos update" ON storage.objects;
DROP POLICY IF EXISTS "client photos delete" ON storage.objects;

-- SELECT scoped por empresa (faltava — só havia upload/update/delete scoped)
CREATE POLICY "Members can view client photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-photos'
  AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);



-- ============================================================
-- Migration: 20260521002724_d736adfd-9923-4c38-9b62-7aaca7a1967f.sql
-- ============================================================

ALTER TABLE public.production_cards DROP CONSTRAINT IF EXISTS production_cards_column_key_check;



-- ============================================================
-- Migration: 20260521115026_c33d6507-3d25-4a89-b8d5-d55e1aa221b3.sql
-- ============================================================

ALTER TABLE public.production_cards ADD COLUMN IF NOT EXISTS category text;



-- ============================================================
-- Migration: 20260521132735_22d1a5a6-2250-4f45-8f26-06d2153f0d6f.sql
-- ============================================================

-- Auto-fill completed_at when card is marked finalizado
CREATE OR REPLACE FUNCTION public.production_cards_autocomplete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.operational_status = 'finalizado' AND OLD.operational_status IS DISTINCT FROM 'finalizado' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  IF NEW.operational_status <> 'finalizado' AND OLD.operational_status = 'finalizado' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_production_cards_autocomplete ON public.production_cards;
CREATE TRIGGER trg_production_cards_autocomplete
BEFORE UPDATE ON public.production_cards
FOR EACH ROW EXECUTE FUNCTION public.production_cards_autocomplete();

-- Department column for sector filtering
ALTER TABLE public.production_cards
  ADD COLUMN IF NOT EXISTS department text;



-- ============================================================
-- Migration: 20260521195711_fc3d6ab3-936d-476e-83b5-6527cf2e6f6f.sql
-- ============================================================

-- Remove duplicate indexes to reduce write cost.
-- Each table below already has another index covering the same column(s).
DROP INDEX IF EXISTS public.idx_pc_assignee;          -- duplicate of idx_production_cards_assignee
DROP INDEX IF EXISTS public.idx_pc_case;              -- duplicate of idx_production_cards_case
DROP INDEX IF EXISTS public.idx_pc_client;            -- duplicate of idx_production_cards_client
DROP INDEX IF EXISTS public.idx_pc_company;           -- duplicate of idx_production_cards_company

DROP INDEX IF EXISTS public.cases_assigned_idx;       -- duplicate of idx_cases_assigned
DROP INDEX IF EXISTS public.cases_client_idx;         -- duplicate of idx_cases_client
DROP INDEX IF EXISTS public.cases_company_idx;        -- duplicate of idx_cases_company
DROP INDEX IF EXISTS public.idx_cases_company_id;     -- duplicate of idx_cases_company

DROP INDEX IF EXISTS public.clients_company_idx;      -- duplicate of idx_clients_company
DROP INDEX IF EXISTS public.idx_clients_company_id;   -- duplicate of idx_clients_company

DROP INDEX IF EXISTS public.idx_documents_card_id;    -- duplicate of idx_documents_card
DROP INDEX IF EXISTS public.idx_contracts_case_id;    -- duplicate of idx_contracts_case

DROP INDEX IF EXISTS public.tasks_assigned_idx;       -- duplicate of idx_tasks_assigned
DROP INDEX IF EXISTS public.tasks_case_idx;           -- duplicate of idx_tasks_case
DROP INDEX IF EXISTS public.tasks_company_idx;        -- duplicate of idx_tasks_company
DROP INDEX IF EXISTS public.tasks_due_idx;            -- duplicate of idx_tasks_due
DROP INDEX IF EXISTS public.idx_tasks_assigned_to;    -- duplicate of idx_tasks_assigned
DROP INDEX IF EXISTS public.idx_tasks_due_date;       -- duplicate of idx_tasks_due

DROP INDEX IF EXISTS public.events_case_idx;          -- duplicate of idx_events_case
DROP INDEX IF EXISTS public.events_company_idx;       -- duplicate of idx_events_company
DROP INDEX IF EXISTS public.events_starts_idx;        -- duplicate of idx_events_starts

DROP INDEX IF EXISTS public.publications_assigned_to_idx; -- duplicate of idx_publications_assigned
DROP INDEX IF EXISTS public.publications_company_idx;     -- duplicate of idx_publications_company
DROP INDEX IF EXISTS public.publications_status_idx;      -- duplicate of idx_publications_status

DROP INDEX IF EXISTS public.deadlines_company_idx;        -- duplicate of idx_deadlines_company
DROP INDEX IF EXISTS public.deadlines_due_idx;            -- duplicate of idx_deadlines_due



-- ============================================================
-- Migration: 20260521212837_58e124e9-ffef-4a1a-b752-76a0d109824f.sql
-- ============================================================


-- 1) Create credentials table
CREATE TABLE public.triagem_credentials (
  triagem_id uuid PRIMARY KEY REFERENCES public.triagens(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  created_by uuid,
  gov_password text,
  inss_password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_triagem_credentials_company ON public.triagem_credentials(company_id);

-- 2) Backfill from existing triagens
INSERT INTO public.triagem_credentials (triagem_id, company_id, created_by, gov_password, inss_password)
SELECT t.id, t.company_id, t.created_by, t.gov_password, t.inss_password
FROM public.triagens t
WHERE t.gov_password IS NOT NULL OR t.inss_password IS NOT NULL;

-- 3) Drop sensitive columns from triagens
ALTER TABLE public.triagens DROP COLUMN gov_password;
ALTER TABLE public.triagens DROP COLUMN inss_password;

-- 4) Enable RLS
ALTER TABLE public.triagem_credentials ENABLE ROW LEVEL SECURITY;

-- 5) Helper: caller is owner/admin or the creator of the triagem
CREATE POLICY "triagem_credentials_select_restricted"
ON public.triagem_credentials FOR SELECT
TO authenticated
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (
    created_by = auth.uid()
    OR public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[])
  )
);

CREATE POLICY "triagem_credentials_insert_restricted"
ON public.triagem_credentials FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_member(auth.uid(), company_id)
  AND (
    created_by = auth.uid()
    OR public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[])
  )
);

CREATE POLICY "triagem_credentials_update_restricted"
ON public.triagem_credentials FOR UPDATE
TO authenticated
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (
    created_by = auth.uid()
    OR public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[])
  )
);

CREATE POLICY "triagem_credentials_delete_restricted"
ON public.triagem_credentials FOR DELETE
TO authenticated
USING (
  public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[])
);

-- 6) Updated_at trigger
CREATE TRIGGER trg_triagem_credentials_updated_at
BEFORE UPDATE ON public.triagem_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();



-- ============================================================
-- Migration: 20260524110500_premium_triage_flow.sql
-- ============================================================

-- Premium triage flow: normalized status, lawyer assignment, conversion links and auditability.
ALTER TABLE public.triagens
  ADD COLUMN IF NOT EXISTS assigned_lawyer_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS demand_type text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS secretary_notes text,
  ADD COLUMN IF NOT EXISTS lawyer_notes text,
  ADD COLUMN IF NOT EXISTS legal_analysis text,
  ADD COLUMN IF NOT EXISTS recommended_action text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_contract_id uuid,
  ADD COLUMN IF NOT EXISTS converted_card_id uuid;

UPDATE public.triagens
SET
  assigned_lawyer_id = COALESCE(assigned_lawyer_id, assigned_to),
  client_id = COALESCE(client_id, converted_client_id),
  document = COALESCE(document, cpf),
  demand_type = COALESCE(demand_type, benefit_type),
  secretary_notes = COALESCE(secretary_notes, observations),
  status = CASE status
    WHEN 'novo' THEN 'waiting_lawyer'
    WHEN 'classificado' THEN 'waiting_lawyer'
    WHEN 'em_atendimento' THEN 'in_attendance'
    WHEN 'convertido' THEN 'converted'
    WHEN 'recusado' THEN 'archived'
    ELSE status
  END
WHERE status IN ('novo', 'classificado', 'em_atendimento', 'convertido', 'recusado')
   OR assigned_lawyer_id IS NULL
   OR client_id IS NULL
   OR document IS NULL
   OR demand_type IS NULL
   OR secretary_notes IS NULL;

ALTER TABLE public.triagens
  DROP CONSTRAINT IF EXISTS triagens_status_check,
  ADD CONSTRAINT triagens_status_check
    CHECK (status IN ('draft', 'waiting_lawyer', 'in_attendance', 'waiting_documents', 'converted', 'archived')),
  DROP CONSTRAINT IF EXISTS triagens_priority_check,
  ADD CONSTRAINT triagens_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_triagens_company_status_created
  ON public.triagens(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triagens_assigned_lawyer_status
  ON public.triagens(company_id, assigned_lawyer_id, status, created_at DESC)
  WHERE assigned_lawyer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_triagens_client
  ON public.triagens(company_id, client_id)
  WHERE client_id IS NOT NULL;

DROP POLICY IF EXISTS "members can view triagens" ON public.triagens;
CREATE POLICY "members can view triagens"
  ON public.triagens FOR SELECT TO authenticated
  USING (
    public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin','assistant']::public.app_role[])
    OR assigned_lawyer_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "members can update triagens" ON public.triagens;
CREATE POLICY "members can update triagens"
  ON public.triagens FOR UPDATE TO authenticated
  USING (
    public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::public.app_role[])
    OR assigned_lawyer_id = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::public.app_role[])
    OR assigned_lawyer_id = auth.uid()
    OR created_by = auth.uid()
  );

-- 20260524152000_finance_audit_contract_source.sql
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS contract_id uuid,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_ref text;

CREATE INDEX IF NOT EXISTS idx_financial_entries_contract
  ON public.financial_entries(company_id, contract_id);

CREATE INDEX IF NOT EXISTS idx_financial_entries_source
  ON public.financial_entries(company_id, source, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_entries_source_ref
  ON public.financial_entries(company_id, source, source_id, source_ref)
  WHERE source IS NOT NULL
    AND source_id IS NOT NULL
    AND source_ref IS NOT NULL;

DROP POLICY IF EXISTS "members can view financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "members can create financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "members can update financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "owners admins delete financial_entries" ON public.financial_entries;

CREATE POLICY "owners admins can view financial_entries" ON public.financial_entries
  FOR SELECT TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE POLICY "owners admins can create financial_entries" ON public.financial_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role])
    AND auth.uid() = created_by
  );

CREATE POLICY "owners admins can update financial_entries" ON public.financial_entries
  FOR UPDATE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE POLICY "owners admins can delete financial_entries" ON public.financial_entries
  FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

-- COMPLETE_TRIAGE_DECISION_FLOW.sql
ALTER TABLE public.triagens
  ADD COLUMN IF NOT EXISTS legal_viability text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS pending_documents text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS attendance_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

ALTER TABLE public.triagens
  DROP CONSTRAINT IF EXISTS triagens_status_check;

ALTER TABLE public.triagens
  ADD CONSTRAINT triagens_status_check
    CHECK (
      status IN (
        'draft',
        'waiting_lawyer',
        'in_attendance',
        'attendance_finished',
        'waiting_documents',
        'converted',
        'archived'
      )
    );

CREATE INDEX IF NOT EXISTS idx_triagens_company_status_created
  ON public.triagens(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triagens_company_assigned
  ON public.triagens(company_id, assigned_to, created_at DESC);

-- ADD_TRIAGE_DOCUMENT_LINK.sql
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS triagem_id uuid REFERENCES public.triagens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_triagem
  ON public.documents(company_id, triagem_id)
  WHERE triagem_id IS NOT NULL;

