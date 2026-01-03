#!/bin/bash

# Deploy email templates to Supabase using Management API
# Usage: ./scripts/deploy-email-templates.sh <project-ref> <access-token>

set -e

PROJECT_REF=$1
ACCESS_TOKEN=$2

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Error: Project ref is required"
    echo "Usage: $0 <project-ref> <access-token>"
    exit 1
fi

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Error: Supabase access token is required"
    echo "Usage: $0 <project-ref> <access-token>"
    exit 1
fi

echo "📧 Deploying email templates to project: $PROJECT_REF"

# Template mapping: config.toml section name -> API template name
declare -A TEMPLATE_MAP=(
    ["confirmation"]="confirmation"
    ["invite"]="invite"
    ["magic_link"]="magic_link"
    ["recovery"]="recovery"
    ["email_change"]="email_change"
    ["reauthentication"]="reauthentication"
)

# Extract subjects from config.toml
extract_subject() {
    local template_name=$1
    local section_pattern="\\[auth\\.email\\.template\\.${template_name}\\]"
    local subject_pattern="subject = \"([^\"]+)\""
    
    # Find the section and extract subject
    awk -v section="$section_pattern" -v pattern="$subject_pattern" '
        /^\[/ { in_section = ($0 ~ section) }
        in_section && $0 ~ pattern {
            match($0, pattern, arr)
            print arr[1]
            exit
        }
    ' config.toml
}

# Read template content from file
read_template_content() {
    local template_file=$1
    if [ ! -f "$template_file" ]; then
        echo "❌ Error: Template file not found: $template_file" >&2
        return 1
    fi
    cat "$template_file"
}

# Build JSON payload for mailer_templates
build_templates_json() {
    local templates_json="{"
    local first=true
    
    for config_name in "${!TEMPLATE_MAP[@]}"; do
        local api_name="${TEMPLATE_MAP[$config_name]}"
        local template_file="templates/${config_name}.html"
        
        if [ ! -f "$template_file" ]; then
            echo "⚠️  Warning: Template file not found: $template_file, skipping..." >&2
            continue
        fi
        
        local subject=$(extract_subject "$config_name")
        if [ -z "$subject" ]; then
            echo "⚠️  Warning: Subject not found for template: $config_name, skipping..." >&2
            continue
        fi
        
        local content=$(read_template_content "$template_file")
        if [ $? -ne 0 ]; then
            continue
        fi
        
        # Escape JSON special characters in content
        content=$(echo "$content" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
        
        if [ "$first" = true ]; then
            first=false
        else
            templates_json+=","
        fi
        
        templates_json+="\"${api_name}\":{"
        templates_json+="\"subject\":\"${subject}\","
        templates_json+="\"content\":\"${content}\""
        templates_json+="}"
        
        echo "✅ Prepared template: $api_name (subject: $subject)" >&2
    done
    
    templates_json+="}"
    echo "$templates_json"
}

# Deploy templates via Supabase Management API
deploy_templates() {
    local templates_json=$1
    
    echo "🚀 Uploading templates to Supabase..."
    
    local response=$(curl -s -w "\n%{http_code}" -X PATCH \
        "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"mailer_templates\":${templates_json}}")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "✅ Email templates deployed successfully!"
        return 0
    else
        echo "❌ Error: Failed to deploy templates (HTTP $http_code)" >&2
        echo "Response: $body" >&2
        return 1
    fi
}

# Main execution
cd "$(dirname "$0")/.." || exit 1

templates_json=$(build_templates_json)
if [ -z "$templates_json" ] || [ "$templates_json" = "{}" ]; then
    echo "❌ Error: No templates to deploy"
    exit 1
fi

deploy_templates "$templates_json"

echo "🎉 Email template deployment completed successfully!"
