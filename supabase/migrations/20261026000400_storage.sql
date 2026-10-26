-- Dock: Supabase Storage для фотофиксации и документов водителей.
-- Оба бакета приватные: файлы отдаются по подписанным ссылкам (signed URL).
--
--   documents/{user_id}/{file}           — сканы паспорта, ВУ, СТС (UC-01)
--   order-photos/{order_id}/{stage}/{file} — фото погрузки/выгрузки (UC-17)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('order-photos', 'order-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy documents_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy documents_select_own on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy order_photos_insert_driver on storage.objects for insert to authenticated
  with check (
    bucket_id = 'order-photos'
    and public.is_order_driver(((storage.foldername(name))[1])::uuid)
  );

create policy order_photos_select_participant on storage.objects for select to authenticated
  using (
    bucket_id = 'order-photos'
    and (public.is_order_participant(((storage.foldername(name))[1])::uuid) or public.is_admin())
  );
