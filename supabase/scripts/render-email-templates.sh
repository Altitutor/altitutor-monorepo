#!/bin/bash

# Substitute __CURRENT_YEAR__ in auth email templates for local Supabase and CI.
# Usage: ./scripts/render-email-templates.sh

set -euo pipefail

YEAR=$(date +%Y)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/../templates"
OUT_DIR="$SCRIPT_DIR/../templates-rendered"
EXPECTED_TEMPLATES=(
  confirmation.html
  invite.html
  magic_link.html
  recovery.html
  email_change.html
  reauthentication.html
)

mkdir -p "$OUT_DIR"

for template_file in "$SRC_DIR"/*.html; do
  filename=$(basename "$template_file")
  sed "s/__CURRENT_YEAR__/$YEAR/g" "$template_file" > "$OUT_DIR/$filename"
done

for filename in "${EXPECTED_TEMPLATES[@]}"; do
  rendered_file="$OUT_DIR/$filename"

  if [[ ! -s "$rendered_file" ]]; then
    echo "Missing rendered email template: $rendered_file" >&2
    exit 1
  fi
done

echo "Rendered email templates to templates-rendered/ (year: $YEAR)"
