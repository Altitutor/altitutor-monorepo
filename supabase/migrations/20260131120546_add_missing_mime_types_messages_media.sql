-- ========================
-- ADD MISSING MIME TYPES TO MESSAGES-MEDIA BUCKET
-- ========================
-- This migration adds additional MIME types that are supported by iMessage
-- but were missing from the bucket configuration:
--   - CSV files (text/csv)
--   - XML files (text/xml, application/xml)
--   - SVG images (image/svg+xml)
--   - Calendar files (text/calendar for .ics)
--   - Contact files (text/vcard for .vcf)
--   - Apple iWork formats (Pages, Numbers, Keynote)
--   - Additional video formats (3GP, MXF)
--   - Apple-specific formats (DMG, PKPass, USDZ)
--   - PSD images (image/vnd.adobe.photoshop)

-- ========================
-- UPDATE BUCKET CONFIGURATION
-- ========================

UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY[
    -- Images
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/tiff',
    'image/bmp',
    'image/svg+xml',  -- Added: SVG images
    'image/vnd.adobe.photoshop',  -- Added: PSD files
    -- Videos
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-m4v',
    'video/3gpp',  -- Added: 3GP video format
    -- Audio
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-m4a',
    'audio/aac',
    'audio/x-aiff',
    'audio/x-caf',
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',  -- Added: CSV files (RFC 4180)
    'text/xml',  -- Added: XML files
    'application/xml',  -- Added: XML files (alternative)
    'text/calendar',  -- Added: ICS calendar files
    'text/vcard',  -- Added: VCF contact files
    -- Apple iWork formats
    'application/vnd.apple.pages',  -- Added: Apple Pages
    'application/vnd.apple.numbers',  -- Added: Apple Numbers
    'application/vnd.apple.keynote',  -- Added: Apple Keynote
    -- Archives and packages
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-apple-diskimage',  -- Added: DMG files
    -- Apple-specific formats
    'application/vnd.apple.pkpass',  -- Added: Apple Wallet passes
    'model/usd',  -- Added: USDZ AR files
    'model/vnd.usdz+zip',  -- Added: USDZ AR files (alternative)
    -- Other
    'application/mxf'  -- Added: MXF video format
  ]
WHERE id = 'messages-media';
