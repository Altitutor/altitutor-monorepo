#!/usr/bin/env bash
set -euo pipefail

app="${1:?Expected app name}"
platform="${2:?Expected platform}"
profile="${3:?Expected EAS build profile}"

case "$app" in student-app|ucat-app) ;; *) echo "Unknown mobile app: $app" >&2; exit 2 ;; esac
case "$platform" in ios|android) ;; *) echo "Unknown platform: $platform" >&2; exit 2 ;; esac
case "$profile" in preview|production) ;; *) echo "Unknown profile: $profile" >&2; exit 2 ;; esac

cd "apps/$app"

fingerprint="$(eas fingerprint:generate \
  --platform "$platform" --build-profile "$profile" --json --non-interactive \
  | node -e 'let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const hash = JSON.parse(input).hash; if (typeof hash !== "string" || !hash) process.exit(2); process.stdout.write(hash); });')"
build_count="$(eas build:list \
  --platform "$platform" --build-profile "$profile" \
  --fingerprint-hash "$fingerprint" --status finished --limit 1 \
  --json --non-interactive \
  | node -e 'let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const builds = JSON.parse(input); if (!Array.isArray(builds)) process.exit(2); process.stdout.write(String(builds.length)); });')"

if [ "$build_count" -gt 0 ]; then
  echo "A compatible $profile $platform build exists for $app ($fingerprint); publishing OTA."
  eas update --channel "$profile" --environment "$profile" \
    --platform "$platform" --message "${GITHUB_SHA:-$(git rev-parse HEAD)}" \
    --non-interactive
  exit 0
fi

echo "No compatible $profile $platform build exists for $app ($fingerprint); building a new binary."
if [ "$profile" = production ] && [ "${MOBILE_STORE_AUTO_SUBMIT_ENABLED:-false}" = true ]; then
  eas build --platform "$platform" --profile "$profile" --non-interactive --auto-submit
else
  eas build --platform "$platform" --profile "$profile" --non-interactive
fi
