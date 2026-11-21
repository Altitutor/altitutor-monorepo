-- DEV-492: a 15-minute take at 1 Mbps video + 64 kbps audio is about 114 MiB.
-- Allow encoder variability while keeping a bounded, immutable upload.
-- CI separately reconciles the hosted global Storage ceiling before deploying
-- clients that use this cap; this migration does not restart any service.
UPDATE storage.buckets
SET file_size_limit = 209715200
WHERE id = 'interview-recordings'
  AND (file_size_limit IS NULL OR file_size_limit < 209715200);

-- Resources previously inherited the verified 50 MiB global ceiling. Preserve
-- that effective bound when the global ceiling rises for interview video.
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'resources' AND file_size_limit IS NULL;
