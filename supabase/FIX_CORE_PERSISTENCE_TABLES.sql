-- Execute este arquivo no Supabase SQL Editor do projeto correto.
-- Ele cria tabelas essenciais de forma idempotente para os fluxos principais
-- de clientes, processos e financeiro.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null,
  name text not null,
  client_type text not null default 'individual',
  document text,
  email text,
  phone text,
  address text,
  city text,
  notes text,
  photo_url text,
  rg text,
  birth_date date,
  marital_status text,
  profession text,
  is_provisional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  cnj_number text,
  internal_number text,
  practice_area text,
  court text,
  instance text,
  case_value numeric,
  polo_ativo text,
  polo_passivo text,
  priority text not null default 'media',
  procedural_status text,
  description text,
  status text not null default 'active',
  phase text,
  assigned_to uuid,
  lawyer_id uuid,
  distribution_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  contract_id uuid,
  entry_type text not null,
  subtype text not null default 'geral',
  category text,
  description text not null,
  amount numeric not null default 0,
  due_date date,
  paid_at date,
  status text not null default 'pendente',
  payment_method text,
  notes text,
  source text,
  source_id uuid,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_company on public.clients(company_id, created_at desc);
create index if not exists idx_cases_company on public.cases(company_id, created_at desc);
create index if not exists idx_financial_entries_company on public.financial_entries(company_id, due_date desc);

alter table public.clients enable row level security;
alter table public.cases enable row level security;
alter table public.financial_entries enable row level security;

drop policy if exists "clients_select_company" on public.clients;
create policy "clients_select_company"
on public.clients for select to authenticated
using (public.is_company_member(auth.uid(), company_id));

drop policy if exists "cases_select_company" on public.cases;
create policy "cases_select_company"
on public.cases for select to authenticated
using (public.is_company_member(auth.uid(), company_id));

drop policy if exists "financial_select_company" on public.financial_entries;
create policy "financial_select_company"
on public.financial_entries for select to authenticated
using (public.is_company_member(auth.uid(), company_id));
