-- Run this once after applying all migrations if users were created before the schema existed.
-- It creates a company, membership, owner role and profile for auth users that do not have a profile.

do $$
declare
  u record;
  _company_id uuid;
  _full_name text;
  _company_name text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.profiles p on p.id = au.id
    where p.id is null
  loop
    _full_name := coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1));
    _company_name := coalesce(u.raw_user_meta_data->>'company_name', _full_name || ' - Escritório');

    insert into public.companies (name, created_by)
    values (_company_name, u.id)
    returning id into _company_id;

    insert into public.company_members (company_id, user_id)
    values (_company_id, u.id)
    on conflict do nothing;

    insert into public.user_roles (user_id, company_id, role)
    values (u.id, _company_id, 'owner')
    on conflict do nothing;

    insert into public.profiles (id, full_name, active_company_id)
    values (u.id, _full_name, _company_id)
    on conflict (id) do update
      set full_name = excluded.full_name,
          active_company_id = excluded.active_company_id;
  end loop;
end $$;
