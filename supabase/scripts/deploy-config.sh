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
