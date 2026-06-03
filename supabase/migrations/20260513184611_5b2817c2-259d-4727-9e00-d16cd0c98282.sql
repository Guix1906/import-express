
REVOKE EXECUTE ON FUNCTION public.shares_company_with(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_company_with(uuid, uuid) TO authenticated;
