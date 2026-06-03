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
