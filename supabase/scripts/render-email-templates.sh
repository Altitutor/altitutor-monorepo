#!/bin/bash

# Substitute __CURRENT_YEAR__ in auth email templates for local Supabase.
# Usage: ./scripts/render-email-templates.sh

set -e

YEAR=$(date +%Y)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/../templates"
OUT_DIR="$SCRIPT_DIR/../templates-rendered"

mkdir -p "$OUT_DIR"

for template_file in "$SRC_DIR"/*.html; do
    filename=$(basename "$template_file")
  sed "s/__CURRENT_YEAR__/$YEAR/g" "$template_file" > "$OUT_DIR/$filename"
done

echo "Rendered email templates to templates-rendered/ (year: $YEAR)"
