#!/bin/bash

# ============================================================
# Supabase Config Deployment Script
# Substitutes environment variables and deploys config.toml
# ============================================================

set -e

PROJECT_REF=$1

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Error: Project reference required"
    echo "Usage: ./deploy-config.sh <project-ref>"
    exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SUPABASE_DIR="$(dirname "$SCRIPT_DIR")"
TEMP_CONFIG=$(mktemp)

echo "📝 Deploying configuration to project: $PROJECT_REF"

# Copy original config to temp file
cp "$SUPABASE_DIR/config.toml" "$TEMP_CONFIG"

# Email credentials
if [ ! -z "$RESEND_API_KEY" ]; then
    sed -i.bak "s|env(RESEND_API_KEY)|$RESEND_API_KEY|g" "$TEMP_CONFIG"
    echo "✅ Substituted RESEND_API_KEY"
fi

# Enable SMTP in production
sed -i.bak 's|enabled = false  # Set to true in production|enabled = true|g' "$TEMP_CONFIG"
echo "✅ Enabled SMTP for production"

# Deploy config using Supabase CLI
echo "🚀 Pushing configuration to Supabase..."
cd "$SUPABASE_DIR"
supabase config push --project-ref "$PROJECT_REF" --config-file "$TEMP_CONFIG" || {
    echo "❌ Failed to push configuration"
    rm -f "$TEMP_CONFIG" "$TEMP_CONFIG.bak"
    exit 1
}

# Cleanup
rm -f "$TEMP_CONFIG" "$TEMP_CONFIG.bak"

echo "✅ Configuration deployed successfully"
