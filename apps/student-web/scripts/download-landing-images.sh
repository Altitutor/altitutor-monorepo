#!/bin/bash

# Script to download landing page images from WordPress site
# Run this from the apps/student-web directory

set -e

BASE_URL="https://student.altitutor.com/wp-content/uploads/sites/2/2023/12"
OUTPUT_DIR="public/images/landing"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# List of image files to download
images=(
  "Altitutor-banner_white_v2-copy-1024x139.png"
  "256-mac.webp"
  "MBA-1-smaller.png"
  "Screenshot-2023-12-08-at-4.41.13 pm-1024x748.png"
  "iPhone-14-Pro-Max-in-deep-purple-color_Messages-515x1024.png"
  "Anki-iphone-ipad-1024x763.png"
  "3S-Cheat-sheet-768x1089.png"
  "PQ-768x1088.png"
  "Test-768x1083.png"
  "Exam-768x1087.png"
  "Screenshot-2023-12-07-at-8.54.54 pm-1024x667.png"
  "iPhone-14-pro-no-border-495x1024.png"
  "UCAT-QR-online-MBP-1024x600.png"
)

echo "Downloading landing page images..."
echo "Output directory: $OUTPUT_DIR"
echo ""

for image in "${images[@]}"; do
  # URL encode the filename properly (handles spaces and special characters)
  encoded_image=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$image'))" 2>/dev/null || echo "$image" | sed 's/ /%20/g')
  url="${BASE_URL}/${encoded_image}"
  output_path="${OUTPUT_DIR}/${image}"
  
  echo "Downloading: $image"
  if curl -f -L -o "$output_path" "$url" 2>/dev/null; then
    echo "  ✓ Success"
  else
    echo "  ⚠ Failed to download $image (may not exist or URL changed)"
    echo "    URL: $url"
    # Continue with other images instead of exiting
  fi
done

echo ""
echo "All images downloaded successfully!"
echo "Images are now available at: $OUTPUT_DIR"

