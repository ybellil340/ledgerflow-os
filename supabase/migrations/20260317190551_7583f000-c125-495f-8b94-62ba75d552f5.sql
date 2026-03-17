
-- Make the documents bucket public so receipt URLs are accessible
UPDATE storage.buckets SET public = true WHERE id = 'documents';

-- Add a public SELECT policy for the documents bucket
CREATE POLICY "Public read access for documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');
