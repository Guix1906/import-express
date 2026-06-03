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