# Landing Page Images

This directory contains images for the student landing page.

## Missing Images

The following images could not be downloaded automatically and may need to be manually added:

1. `Screenshot-2023-12-08-at-4.41.13 pm-1024x748.png` - Study notes screenshot
2. `Screenshot-2023-12-07-at-8.54.54 pm-1024x667.png` - UCAT screenshot

These images are used in:
- **Study Notes Screenshot**: ResourcesSection component (Study Notes card)
- **UCAT Screenshot**: UCATSection component

## Downloading Images

To download all images, run:

```bash
cd apps/student-web
./scripts/download-landing-images.sh
```

Or manually download from:
- Base URL: `https://student.altitutor.com/wp-content/uploads/sites/2/2023/12/`

## Image Optimization

All images are optimized by Next.js Image component automatically. Make sure to:
- Use appropriate `width` and `height` props
- Set `priority={true}` for above-the-fold images
- Use `loading="lazy"` for below-the-fold images (default)

