CREATE POLICY "Users can upload their own scan images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own scan images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own scan images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);