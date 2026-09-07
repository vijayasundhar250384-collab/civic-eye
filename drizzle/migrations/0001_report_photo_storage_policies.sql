create policy "report photos readable by authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'report-photos');

create policy "report photos upload own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "report photos update own folder"
on storage.objects for update to authenticated
using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);