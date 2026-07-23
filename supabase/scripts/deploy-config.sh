#!/bin/bash

# Deploy hosted Auth configuration via the Supabase Management API.
# Usage: ./scripts/deploy-config.sh <project-ref>

set -e

PROJECT_REF=$1

if [ -z "$PROJECT_REF" ]; then
    echo "Error: Project ref is required"
    echo "Usage: $0 <project-ref>"
    exit 1
fi

echo "📝 Deploying configuration to project: $PROJECT_REF"

# Email credentials - RESEND_API_KEY is required
if [ -z "$RESEND_API_KEY" ]; then
    echo "❌ Error: RESEND_API_KEY environment variable is not set"
    echo "Please set RESEND_API_KEY in your GitHub Actions secrets"
    exit 1
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ Error: SUPABASE_ACCESS_TOKEN environment variable is not set"
    echo "Please set SUPABASE_ACCESS_TOKEN in your GitHub Actions secrets"
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "❌ Error: jq is required to build the Management API payload"
    exit 1
fi

echo "✅ Using RESEND_API_KEY from environment"
echo "✅ Using SUPABASE_ACCESS_TOKEN from environment"
echo "✅ Enabling custom SMTP for hosted Supabase Auth"

# CI sets SUPABASE_CONFIG_ENV to production (main) or development (develop) — see supabase-deploy.yml.
# For manual runs, default to production so localhost-heavy dev redirects are not applied by accident.
SUPABASE_CONFIG_ENV="${SUPABASE_CONFIG_ENV:-production}"
echo "🔧 SUPABASE_CONFIG_ENV=$SUPABASE_CONFIG_ENV"

normalize_bool() {
  case "${1:-false}" in
    1|true|TRUE|True) echo true ;;
    0|false|FALSE|False|"") echo false ;;
    *)
      echo "❌ Error: expected a boolean provider flag, received '$1'" >&2
      exit 1
      ;;
  esac
}

GOOGLE_AUTH_ENABLED=$(normalize_bool "${AUTH_GOOGLE_ENABLED:-false}")
APPLE_AUTH_ENABLED=$(normalize_bool "${AUTH_APPLE_ENABLED:-false}")

if [ "$GOOGLE_AUTH_ENABLED" = "true" ]; then
  if [ -z "$SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID" ] || [ -z "$SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET" ]; then
    echo "❌ Error: Google Auth is enabled but its Supabase client ID or client secret is missing"
    exit 1
  fi
fi

if [ "$APPLE_AUTH_ENABLED" = "true" ]; then
  if [ -z "$SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID" ] || [ -z "$SUPABASE_AUTH_EXTERNAL_APPLE_SECRET" ]; then
    echo "❌ Error: Apple Auth is enabled but its Supabase Services ID or client secret is missing"
    exit 1
  fi
fi

echo "✅ Google Auth enabled: $GOOGLE_AUTH_ENABLED"
echo "✅ Apple Auth enabled: $APPLE_AUTH_ENABLED"
echo "✅ Manual identity linking enabled"

# Custom SMTP unlocks configurable email limits (built-in provider stays at ~2/hour).
if [ "$SUPABASE_CONFIG_ENV" = "development" ]; then
  AUTH_EMAIL_SENT_LIMIT="${AUTH_EMAIL_SENT_LIMIT:-200}"
else
  AUTH_EMAIL_SENT_LIMIT="${AUTH_EMAIL_SENT_LIMIT:-100}"
fi
echo "✅ Set auth.rate_limit.email_sent to $AUTH_EMAIL_SENT_LIMIT for $SUPABASE_CONFIG_ENV"

# Portal base URLs: use GitHub Environment variables when hosts differ from defaults.
# development defaults match *.development.altitutor.com; production defaults match prod.
if [ "$SUPABASE_CONFIG_ENV" = "development" ]; then
  ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.development.altitutor.com}"
  STUDENT_URL="${NEXT_PUBLIC_STUDENT_URL:-https://student.development.altitutor.com}"
  TUTOR_URL="${NEXT_PUBLIC_TUTOR_URL:-https://tutor.development.altitutor.com}"
  UCAT_URL="${NEXT_PUBLIC_UCAT_URL:-https://ucat.development.altitutor.com}"
  # Local apps hitting the remote *dev* Supabase project (magic links, OAuth callbacks).
  LOCALHOST_AUTH_REDIRECTS=",http://localhost:3000/auth/callback,http://localhost:3000/**,http://localhost:3001/auth/callback,http://localhost:3001/**,http://localhost:3002/auth/callback,http://localhost:3002/**,http://localhost:3004/auth/callback,http://localhost:3004/**"
else
  ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.altitutor.com}"
  STUDENT_URL="${NEXT_PUBLIC_STUDENT_URL:-https://student.altitutor.com}"
  TUTOR_URL="${NEXT_PUBLIC_TUTOR_URL:-https://tutor.altitutor.com}"
  UCAT_URL="${NEXT_PUBLIC_UCAT_URL:-https://ucat.altitutor.com}"
  # Optional local UCAT smoke tests against prod auth; omit other ports on prod for a tighter allowlist.
  LOCALHOST_AUTH_REDIRECTS=",http://localhost:3004/auth/callback,http://localhost:3004/**"
fi

# The dev OAuth server builds its consent URL from site_url + authorization path,
# so dev must use tutor-web as the canonical Auth site. Production keeps the
# existing admin default until the production MCP is intentionally enabled.
if [ "$SUPABASE_CONFIG_ENV" = "development" ]; then
  PROD_SITE_URL="$TUTOR_URL"
  OAUTH_SERVER_ENABLED=true
  OAUTH_SERVER_ALLOW_DYNAMIC_REGISTRATION=true
  OAUTH_SERVER_AUTHORIZATION_PATH="/oauth/consent"
else
  PROD_SITE_URL="$ADMIN_URL"
  OAUTH_SERVER_ENABLED=false
  OAUTH_SERVER_ALLOW_DYNAMIC_REGISTRATION=false
  OAUTH_SERVER_AUTHORIZATION_PATH=""
fi
echo "✅ Updated site_url to $PROD_SITE_URL"
echo "✅ OAuth server enabled: $OAUTH_SERVER_ENABLED"
if [ "$OAUTH_SERVER_ENABLED" = "true" ]; then
  echo "✅ OAuth dynamic client registration enabled"
  echo "✅ OAuth authorization path: $OAUTH_SERVER_AUTHORIZATION_PATH"
fi

# Build the hosted Auth URI allow-list. The Management API expects this as a comma-separated string.
REDIRECT_URLS="$ADMIN_URL/auth/callback,$STUDENT_URL/auth/callback,$TUTOR_URL/auth/callback,$UCAT_URL/auth/callback,$ADMIN_URL/**,$STUDENT_URL/**,$TUTOR_URL/**,$UCAT_URL/**$LOCALHOST_AUTH_REDIRECTS"
echo "✅ Updated additional_redirect_urls (portals + localhost rules for $SUPABASE_CONFIG_ENV)"

PAYLOAD=$(jq -n \
  --arg site_url "$PROD_SITE_URL" \
  --arg uri_allow_list "$REDIRECT_URLS" \
  --arg resend_api_key "$RESEND_API_KEY" \
  --arg google_client_id "${SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID:-}" \
  --arg google_client_secret "${SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET:-}" \
  --arg apple_client_id "${SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID:-}" \
  --arg apple_secret "${SUPABASE_AUTH_EXTERNAL_APPLE_SECRET:-}" \
  --arg oauth_server_authorization_path "$OAUTH_SERVER_AUTHORIZATION_PATH" \
  --argjson rate_limit_email_sent "$AUTH_EMAIL_SENT_LIMIT" \
  --argjson google_auth_enabled "$GOOGLE_AUTH_ENABLED" \
  --argjson apple_auth_enabled "$APPLE_AUTH_ENABLED" \
  --argjson oauth_server_enabled "$OAUTH_SERVER_ENABLED" \
  --argjson oauth_server_allow_dynamic_registration "$OAUTH_SERVER_ALLOW_DYNAMIC_REGISTRATION" \
  '{
    site_url: $site_url,
    uri_allow_list: $uri_allow_list,
    rate_limit_email_sent: $rate_limit_email_sent,
    smtp_host: "smtp.resend.com",
    smtp_port: "587",
    smtp_user: "resend",
    smtp_pass: $resend_api_key,
    smtp_admin_email: "noreply@altitutor.com",
    smtp_sender_name: "Altitutor",
    disable_signup: false,
    jwt_exp: 3600,
    external_anonymous_users_enabled: false,
    external_email_enabled: true,
    external_phone_enabled: false,
    refresh_token_rotation_enabled: true,
    security_refresh_token_reuse_interval: 10,
    security_manual_linking_enabled: true,
    mailer_secure_email_change_enabled: true,
    mailer_autoconfirm: false,
    security_update_password_require_reauthentication: false,
    password_min_length: 6,
    password_required_characters: "",
    mfa_max_enrolled_factors: 10,
    mfa_totp_enroll_enabled: false,
    mfa_totp_verify_enabled: false,
    mfa_phone_enroll_enabled: false,
    mfa_phone_verify_enabled: false,
    external_google_enabled: $google_auth_enabled,
    external_apple_enabled: $apple_auth_enabled
  }
  + (if $google_auth_enabled then {
      external_google_client_id: $google_client_id,
      external_google_secret: $google_client_secret
    } else {} end)
  + (if $apple_auth_enabled then {
      external_apple_client_id: $apple_client_id,
      external_apple_secret: $apple_secret
    } else {} end)
  + (if $oauth_server_enabled then {
      oauth_server_enabled: true,
      oauth_server_allow_dynamic_registration: $oauth_server_allow_dynamic_registration,
      oauth_server_authorization_path: $oauth_server_authorization_path
    } else {} end)')

echo "🚀 Patching hosted Auth configuration via Supabase Management API..."
echo "📋 Payload keys:"
echo "$PAYLOAD" | jq 'keys'

RESPONSE=$(curl -sS -w "\n%{http_code}" -X PATCH \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "✅ Hosted Auth configuration updated successfully"
    echo "$BODY" | jq -r '
        if .site_url then "  ✅ site_url: \(.site_url)" else empty end,
        if .uri_allow_list then "  ✅ uri_allow_list updated" else empty end,
        if .rate_limit_email_sent then "  ✅ rate_limit_email_sent: \(.rate_limit_email_sent)" else empty end,
        if .oauth_server_enabled != null then "  ✅ oauth_server_enabled: \(.oauth_server_enabled)" else empty end,
        if .oauth_server_allow_dynamic_registration != null then "  ✅ oauth_server_allow_dynamic_registration: \(.oauth_server_allow_dynamic_registration)" else empty end,
        if .oauth_server_authorization_path then "  ✅ oauth_server_authorization_path: \(.oauth_server_authorization_path)" else empty end,
        if .smtp_host then "  ✅ smtp_host: \(.smtp_host)" else empty end
    ' 2>/dev/null || true
else
    echo "❌ Error deploying Auth configuration. HTTP $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi

echo "🎉 Configuration deployment completed successfully!"
