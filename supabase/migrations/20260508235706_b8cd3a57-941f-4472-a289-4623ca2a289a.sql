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