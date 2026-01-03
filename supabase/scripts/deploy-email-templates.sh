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

# Extract subjects from config.toml
declare -A SUBJECTS=()
while IFS= read -r line; do
    if [[ $line =~ ^\[auth\.email\.template\.(.+)\] ]]; then
        current_template="${BASH_REMATCH[1]}"
    elif [[ $line =~ ^subject\s*=\s*\"(.+)\" ]] && [ -n "$current_template" ]; then
        SUBJECTS["$current_template"]="${BASH_REMATCH[1]}"
    fi
done < config.toml

# Build the mailer_templates JSON payload
TEMPLATES_DIR="$(dirname "$0")/../templates"
PAYLOAD_TEMPLATES="{}"

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
    content=$(cat "$template_path" | jq -Rs .)
    
    # Build template JSON object
    template_json=$(jq -n \
        --arg subject "$subject" \
        --argjson content "$content" \
        '{subject: $subject, content: $content}')
    
    # Add to payload
    PAYLOAD_TEMPLATES=$(echo "$PAYLOAD_TEMPLATES" | jq --arg name "$template_name" --argjson template "$template_json" '.[$name] = $template')
    
    echo "✅ Prepared template: $template_name"
done

# Build final payload
PAYLOAD=$(jq -n --argjson templates "$PAYLOAD_TEMPLATES" '{mailer_templates: $templates}')

# Deploy templates via Management API
echo "🚀 Uploading templates to Supabase..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "🎉 Email templates deployed successfully!"
    echo "📊 Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "❌ Error deploying templates. HTTP $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi
