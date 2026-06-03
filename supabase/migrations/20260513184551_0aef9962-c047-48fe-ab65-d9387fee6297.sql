
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
