-- Bucket público para fotos de clientes
insert into storage.buckets (id, name, public)
values ('client-photos', 'client-photos', true)
on conflict (id) do nothing;

-- Leitura pública
create policy "Public can view client photos"
on storage.objects for select
using (bucket_id = 'client-photos');

-- Membros podem subir fotos (pasta = company_id)
create policy "Members can upload client photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-photos'
  and is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Membros podem atualizar
create policy "Members can update client photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-photos'
  and is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Owners/admins podem deletar
create policy "Owners/admins can delete client photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-photos'
  and has_any_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::app_role,'admin'::app_role])
);