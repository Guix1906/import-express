-- Self-service workspace repair/onboarding for authenticated users.
-- This is intentionally SECURITY DEFINER so a user without a company can create
-- the first workspace without bypassing RLS from the browser.
CREATE OR REPLACE FUNCTION public.ensure_user_workspace(
  _company_name text,
  _full_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _company_id uuid;
  _resolved_name text;
  _resolved_company text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  _resolved_company := NULLIF(BTRIM(_company_name), '');
  IF _resolved_company IS NULL OR LENGTH(_resolved_company) < 2 THEN
    RAISE EXCEPTION 'company_name_required';
  END IF;

  _resolved_name := NULLIF(BTRIM(COALESCE(_full_name, '')), '');

  SELECT p.active_company_id
    INTO _company_id
  FROM public.profiles p
  WHERE p.id = _user_id
    AND p.active_company_id IS NOT NULL
  LIMIT 1;

  IF _company_id IS NULL THEN
    SELECT cm.company_id
      INTO _company_id
    FROM public.company_members cm
    WHERE cm.user_id = _user_id
    ORDER BY cm.created_at ASC
    LIMIT 1;
  END IF;

  IF _company_id IS NULL THEN
    INSERT INTO public.companies (name, created_by)
    VALUES (_resolved_company, _user_id)
    RETURNING id INTO _company_id;

    INSERT INTO public.company_members (company_id, user_id)
    VALUES (_company_id, _user_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (_user_id, _company_id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.profiles (id, full_name, active_company_id)
  VALUES (_user_id, _resolved_name, _company_id)
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        active_company_id = COALESCE(public.profiles.active_company_id, EXCLUDED.active_company_id),
        updated_at = now();

  RETURN _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_workspace(text, text) TO authenticated;
