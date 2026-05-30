#!/bin/bash

# Deploy configuration with environment variable substitution
# Usage: ./scripts/deploy-config.sh <project-ref>

set -e

PROJECT_REF=$1

if [ -z "$PROJECT_REF" ]; then
    echo "Error: Project ref is required"
    echo "Usage: $0 <project-ref>"
    exit 1
fi

echo "📝 Deploying configuration to project: $PROJECT_REF"

# Create a temporary config file with environment variables substituted
TEMP_CONFIG=$(mktemp)
cp config.toml "$TEMP_CONFIG"

# Substitute environment variables
echo "🔄 Substituting environment variables..."

# Email credentials - RESEND_API_KEY is required
if [ -z "$RESEND_API_KEY" ]; then
    echo "❌ Error: RESEND_API_KEY environment variable is not set"
    echo "Please set RESEND_API_KEY in your GitHub Actions secrets"
    rm -f "$TEMP_CONFIG"
    exit 1
fi

sed -i.bak "s|env(RESEND_API_KEY)|$RESEND_API_KEY|g" "$TEMP_CONFIG"
echo "✅ Substituted RESEND_API_KEY"

# Verify substitution worked
if grep -q "env(RESEND_API_KEY)" "$TEMP_CONFIG"; then
    echo "❌ Error: RESEND_API_KEY substitution failed"
    rm -f "$TEMP_CONFIG" "$TEMP_CONFIG.bak"
    exit 1
fi

# Enable SMTP in production
sed -i.bak 's|enabled = false  # Set to true in production|enabled = true|g' "$TEMP_CONFIG"
echo "✅ Enabled SMTP for production"

# CI sets SUPABASE_CONFIG_ENV to production (main) or development (develop) — see supabase-deploy.yml.
# For manual runs, default to production so localhost-heavy dev redirects are not applied by accident.
SUPABASE_CONFIG_ENV="${SUPABASE_CONFIG_ENV:-production}"
echo "🔧 SUPABASE_CONFIG_ENV=$SUPABASE_CONFIG_ENV"

# Portal base URLs: use GitHub Environment variables when hosts differ from defaults.
# development defaults match *.development.altitutor.com; production defaults match prod.
if [ "$SUPABASE_CONFIG_ENV" = "development" ]; then
  ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.development.altitutor.com}"
  STUDENT_URL="${NEXT_PUBLIC_STUDENT_URL:-https://student.development.altitutor.com}"
  TUTOR_URL="${NEXT_PUBLIC_TUTOR_URL:-https://tutor.development.altitutor.com}"
  UCAT_URL="${NEXT_PUBLIC_UCAT_URL:-https://ucat.development.altitutor.com}"
  # Local apps hitting the remote *dev* Supabase project (magic links, OAuth callbacks).
  LOCALHOST_AUTH_REDIRECTS=', "http://localhost:3000/auth/callback", "http://localhost:3000/**", "http://localhost:3001/auth/callback", "http://localhost:3001/**", "http://localhost:3002/auth/callback", "http://localhost:3002/**", "http://localhost:3004/auth/callback", "http://localhost:3004/**"'
else
  ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.altitutor.com}"
  STUDENT_URL="${NEXT_PUBLIC_STUDENT_URL:-https://student.altitutor.com}"
  TUTOR_URL="${NEXT_PUBLIC_TUTOR_URL:-https://tutor.altitutor.com}"
  UCAT_URL="${NEXT_PUBLIC_UCAT_URL:-https://ucat.altitutor.com}"
  # Optional local UCAT smoke tests against prod auth; omit other ports on prod for a tighter allowlist.
  LOCALHOST_AUTH_REDIRECTS=', "http://localhost:3004/auth/callback", "http://localhost:3004/**"'
fi

# Default site_url (fallback when redirect_to is missing / invalid) follows admin portal for this env.
PROD_SITE_URL="$ADMIN_URL"
sed -i.bak "s|site_url = \"http://localhost:3000\"|site_url = \"$PROD_SITE_URL\"|g" "$TEMP_CONFIG"
echo "✅ Updated site_url to $PROD_SITE_URL"

# Build additional_redirect_urls: deployed portals + localhost (dev) or minimal localhost (prod).
REDIRECT_URLS="[\"$ADMIN_URL/auth/callback\", \"$STUDENT_URL/auth/callback\", \"$TUTOR_URL/auth/callback\", \"$UCAT_URL/auth/callback\", \"$ADMIN_URL/**\", \"$STUDENT_URL/**\", \"$TUTOR_URL/**\", \"$UCAT_URL/**\"$LOCALHOST_AUTH_REDIRECTS]"

# Replace the empty additional_redirect_urls array
sed -i.bak "s|additional_redirect_urls = \[\]|additional_redirect_urls = $REDIRECT_URLS|g" "$TEMP_CONFIG"
echo "✅ Updated additional_redirect_urls (portals + localhost rules for $SUPABASE_CONFIG_ENV)"

# Copy the processed config to the current directory temporarily
cp "$TEMP_CONFIG" config.toml

# Push the configuration
echo "🚀 Pushing configuration to Supabase..."
supabase config push --project-ref "$PROJECT_REF"

# Restore the original config file
git checkout config.toml
echo "✅ Restored original config.toml"

# Clean up
rm -f "$TEMP_CONFIG" "$TEMP_CONFIG.bak"

echo "🎉 Configuration deployment completed successfully!"
