
-- Remove policies abertas/públicas
DROP POLICY IF EXISTS "Public can view client photos" ON storage.objects;
DROP POLICY IF EXISTS "client photos read" ON storage.objects;
DROP POLICY IF EXISTS "client photos write" ON storage.objects;
DROP POLICY IF EXISTS "client photos update" ON storage.objects;
DROP POLICY IF EXISTS "client photos delete" ON storage.objects;

-- SELECT scoped por empresa (faltava — só havia upload/update/delete scoped)
CREATE POLICY "Members can view client photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-photos'
  AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
