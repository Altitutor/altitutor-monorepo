#!/bin/bash

# Deploy email templates to Supabase using Management API
# Usage: ./scripts/deploy-email-templates.sh <project-ref>

set -e

PROJECT_REF=$1

if [ -z "$PROJECT_REF" ]; then
    echo "Error: Project ref is required"
    echo "Usage: $0 <project-ref>"
    exit 1
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ Error: SUPABASE_ACCESS_TOKEN environment variable is not set"
    echo "Please set SUPABASE_ACCESS_TOKEN in your GitHub Actions secrets"
    exit 1
fi

echo "📧 Deploying email templates to project: $PROJECT_REF"

# Template mapping: config.toml section name -> template file name
declare -A TEMPLATES=(
    ["confirmation"]="confirmation.html"
    ["invite"]="invite.html"
    ["magic_link"]="magic_link.html"
    ["recovery"]="recovery.html"
    ["email_change"]="email_change.html"
    ["reauthentication"]="reauthentication.html"
)

# Get the supabase directory (parent of scripts directory)
SUPABASE_DIR="$(dirname "$0")/.."
CONFIG_FILE="$SUPABASE_DIR/config.toml"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: config.toml not found at $CONFIG_FILE"
    exit 1
fi

# Extract subjects from config.toml
declare -A SUBJECTS=()
current_template=""

# Debug: Show config file path
echo "📄 Reading config from: $CONFIG_FILE"

while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    
    # Trim leading/trailing whitespace
    line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Match section header: [auth.email.template.xxx]
    if [[ $line =~ ^\[auth\.email\.template\.([^]]+)\] ]]; then
        current_template="${BASH_REMATCH[1]}"
        echo "🔍 Found template section: $current_template"
    # Match subject line: subject = "xxx" (with optional whitespace)
    elif [[ $line =~ ^subject[[:space:]]*=[[:space:]]*\"([^\"]+)\" ]] && [ -n "$current_template" ]; then
        subject_value="${BASH_REMATCH[1]}"
        SUBJECTS["$current_template"]="$subject_value"
        echo "  ✅ Extracted subject: $subject_value"
        current_template=""  # Reset after finding subject
    elif [[ $line =~ ^\[ ]] && [ -n "$current_template" ]; then
        # New section started without finding subject - reset
        current_template=""
    fi
done < "$CONFIG_FILE"

# Debug: Show extracted subjects
if [ ${#SUBJECTS[@]} -eq 0 ]; then
    echo "⚠️  Warning: No subjects extracted from config.toml"
    echo "   Config file: $CONFIG_FILE"
    echo "   This may indicate a parsing issue or missing subjects in config.toml"
else
    echo "✅ Successfully extracted ${#SUBJECTS[@]} email template subject(s)"
fi

# Build the mailer_templates JSON payload
TEMPLATES_DIR="$(dirname "$0")/../templates"
PAYLOAD_TEMPLATES="{}"
TEMPLATES_PREPARED=0

echo "📦 Preparing email templates..."

for template_name in "${!TEMPLATES[@]}"; do
    template_file="${TEMPLATES[$template_name]}"
    template_path="$TEMPLATES_DIR/$template_file"
    subject="${SUBJECTS[$template_name]}"
    
    if [ ! -f "$template_path" ]; then
        echo "⚠️  Warning: Template file not found: $template_path"
        continue
    fi
    
    if [ -z "$subject" ]; then
        echo "⚠️  Warning: Subject not found for template: $template_name"
        continue
    fi
    
    # Read template content and escape JSON
    if ! content=$(cat "$template_path" | jq -Rs .); then
        echo "❌ Error: Failed to read or parse template file: $template_path"
        continue
    fi
    
    # Build template JSON object
    if ! template_json=$(jq -n \
        --arg subject "$subject" \
        --argjson content "$content" \
        '{subject: $subject, content: $content}'); then
        echo "❌ Error: Failed to build JSON for template: $template_name"
        continue
    fi
    
    # Add to payload
    if ! PAYLOAD_TEMPLATES=$(echo "$PAYLOAD_TEMPLATES" | jq --arg name "$template_name" --argjson template "$template_json" '.[$name] = $template'); then
        echo "❌ Error: Failed to add template to payload: $template_name"
        continue
    fi
    
    echo "✅ Prepared template: $template_name"
    TEMPLATES_PREPARED=$((TEMPLATES_PREPARED + 1))
done

# Validate we have templates to deploy
if [ $TEMPLATES_PREPARED -eq 0 ]; then
    echo "❌ Error: No templates were prepared for deployment"
    echo "   Check that:"
    echo "   1. Subjects are correctly defined in config.toml"
    echo "   2. Template files exist in $TEMPLATES_DIR"
    exit 1
fi

echo "✅ Prepared $TEMPLATES_PREPARED template(s) for deployment"

# Build final payload
if ! PAYLOAD=$(jq -n --argjson templates "$PAYLOAD_TEMPLATES" '{mailer_templates: $templates}'); then
    echo "❌ Error: Failed to build final payload"
    exit 1
fi

# Deploy templates via Management API
echo "🚀 Uploading templates to Supabase..."
echo "📋 Payload summary:"
echo "$PAYLOAD" | jq '.mailer_templates | keys' 2>/dev/null || echo "   (unable to parse payload)"

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "🎉 Email templates deployed successfully!"
    echo "📊 Verifying deployment..."
    
    # Extract and show the deployed template subjects for verification
    if command -v jq >/dev/null 2>&1; then
        echo "$BODY" | jq -r '
            .mailer_subjects_confirmation // empty | "  ✅ Confirmation: " + .,
            .mailer_subjects_invite // empty | "  ✅ Invite: " + .,
            .mailer_subjects_magic_link // empty | "  ✅ Magic Link: " + .,
            .mailer_subjects_recovery // empty | "  ✅ Recovery: " + .,
            .mailer_subjects_email_change // empty | "  ✅ Email Change: " + .,
            .mailer_subjects_reauthentication // empty | "  ✅ Reauthentication: " + .
        ' 2>/dev/null || true
    fi
else
    echo "❌ Error deploying templates. HTTP $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi
