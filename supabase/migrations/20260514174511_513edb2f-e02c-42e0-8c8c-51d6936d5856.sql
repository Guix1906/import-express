
CREATE POLICY "members can insert sync logs"
ON public.publication_sync_logs
FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can update sync logs"
ON public.publication_sync_logs
FOR UPDATE TO authenticated
USING (is_company_member(auth.uid(), company_id));
