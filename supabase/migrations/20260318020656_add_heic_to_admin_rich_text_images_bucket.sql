-- Migration: Add HEIC/HEIF to admin-rich-text-images bucket allowed mime types
-- Apple devices commonly use HEIC format for photos

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif'
]
WHERE id = 'admin-rich-text-images';
