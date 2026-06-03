
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
