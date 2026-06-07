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

# Build flat Management API payload (mailer_subjects_* + mailer_templates_*_content).
# Nested { mailer_templates: { ... } } is ignored by the API — subjects appeared to deploy
# but HTML bodies were never updated.
TEMPLATES_DIR="$(dirname "$0")/../templates"
PAYLOAD="{}"
TEMPLATES_PREPARED=0

echo "📦 Preparing email templates..."

for template_name in "${!TEMPLATES[@]}"; do
    template_file="${TEMPLATES[$template_name]}"
    template_path="$TEMPLATES_DIR/$template_file"
    subject="${SUBJECTS[$template_name]}"
    subject_key="mailer_subjects_${template_name}"
    content_key="mailer_templates_${template_name}_content"
    
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
    
    if ! PAYLOAD=$(echo "$PAYLOAD" | jq \
        --arg subject_key "$subject_key" \
        --arg subject "$subject" \
        --arg content_key "$content_key" \
        --argjson content "$content" \
        '. + { ($subject_key): $subject, ($content_key): $content }'); then
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

# Deploy templates via Management API
echo "🚀 Uploading templates to Supabase..."
echo "📋 Payload keys:"
echo "$PAYLOAD" | jq 'keys' 2>/dev/null || echo "   (unable to parse payload)"

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
    
    if command -v jq >/dev/null 2>&1; then
        echo "$BODY" | jq -r '
            .mailer_subjects_confirmation // empty | "  ✅ Confirmation subject: " + .,
            .mailer_subjects_invite // empty | "  ✅ Invite subject: " + .,
            .mailer_subjects_magic_link // empty | "  ✅ Magic Link subject: " + .,
            .mailer_subjects_recovery // empty | "  ✅ Recovery subject: " + .,
            .mailer_subjects_email_change // empty | "  ✅ Email Change subject: " + .,
            .mailer_subjects_reauthentication // empty | "  ✅ Reauthentication subject: " + .
        ' 2>/dev/null || true

        recovery_content=$(echo "$BODY" | jq -r '.mailer_templates_recovery_content // empty' 2>/dev/null || true)
        if [ -n "$recovery_content" ] && echo "$recovery_content" | grep -q 'token_hash'; then
            echo "  ✅ Recovery content: includes token_hash (cross-browser reset link)"
        elif [ -n "$recovery_content" ]; then
            echo "  ⚠️  Recovery content: deployed but missing token_hash — check recovery.html"
        else
            echo "  ⚠️  Recovery content: not returned in API response (re-run or check dashboard)"
        fi

        confirmation_content=$(echo "$BODY" | jq -r '.mailer_templates_confirmation_content // empty' 2>/dev/null || true)
        if [ -n "$confirmation_content" ] && echo "$confirmation_content" | grep -q 'token_hash'; then
            echo "  ✅ Confirmation content: includes token_hash (cross-browser signup link)"
        fi
    fi
else
    echo "❌ Error deploying templates. HTTP $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi
