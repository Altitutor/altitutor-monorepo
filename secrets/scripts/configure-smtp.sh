#!/bin/bash

# ============================================================
# Supabase SMTP Configuration Script
# Configures SMTP settings for Supabase Auth via Management API
# ============================================================

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"

# Source common utilities
source "$SCRIPT_DIR/common.sh"

# Reset counters (in case script is called from another script)
SUCCESS_COUNT=0
FAILURE_COUNT=0
TOTAL_COUNT=0

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Supabase SMTP Configuration${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check prerequisites
check_command "curl" "Install with: brew install curl" || exit 1
check_env_file "$SECRETS_DIR/.env.shared" || exit 1

# Function to configure SMTP for a project
configure_smtp() {
    local project_ref=$1
    local environment=$2
    local access_token=$3
    local resend_api_key=$4
    local admin_email=$5
    local sender_name=$6
    
    if [ -z "$resend_api_key" ]; then
        echo -e "${YELLOW}  ⊘ Skipping SMTP configuration for $environment (RESEND_API_KEY not set)${NC}"
        return
    fi
    
    if [ -z "$admin_email" ]; then
        echo -e "${YELLOW}  ⊘ Skipping SMTP configuration for $environment (SMTP_ADMIN_EMAIL not set)${NC}"
        return
    fi
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    # Match deploy-config.sh defaults: higher on dev for auth-flow testing.
    local email_sent_limit=100
    if [ "$environment" = "development" ]; then
        email_sent_limit=200
    fi
    
    # Configure SMTP via Management API
    local response=$(curl -s -w "\n%{http_code}" -X PATCH \
        "https://api.supabase.com/v1/projects/$project_ref/config/auth" \
        -H "Authorization: Bearer $access_token" \
        -H "Content-Type: application/json" \
        -d "{
            \"external_email_enabled\": true,
            \"mailer_secure_email_change_enabled\": true,
            \"mailer_autoconfirm\": false,
            \"smtp_admin_email\": \"$admin_email\",
            \"smtp_host\": \"smtp.resend.com\",
            \"smtp_port\": 587,
            \"smtp_user\": \"resend\",
            \"smtp_pass\": \"$resend_api_key\",
            \"smtp_sender_name\": \"${sender_name:-Altitutor}\",
            \"rate_limit_email_sent\": $email_sent_limit,
            \"rate_limit_otp\": $email_sent_limit
        }")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 204 ]; then
        echo -e "${GREEN}  ✓ SMTP configured for $environment project: $project_ref${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}  ✗ Failed to configure SMTP for $environment project: $project_ref${NC}"
        if [ -n "$body" ]; then
            echo -e "${YELLOW}    Error: $(echo "$body" | head -1)${NC}"
        fi
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi
}

# ============================================================
# Configure Development SMTP
# ============================================================

echo -e "${BLUE}1. Configuring Development SMTP${NC}"

# Get values from environment files
DEV_PROJECT_REF=$(get_env_value "$SECRETS_DIR/.env.development" "SUPABASE_PROJECT_ID" || true)
if [ -z "$DEV_PROJECT_REF" ]; then
    DEV_PROJECT_REF=$(get_env_value "$SECRETS_DIR/.env.development" "SUPABASE_PROJECT_REF" || true)
fi

ACCESS_TOKEN=$(get_env_value "$SECRETS_DIR/.env.shared" "SUPABASE_ACCESS_TOKEN" || true)
if [ -z "$ACCESS_TOKEN" ]; then
    ACCESS_TOKEN=$(get_env_value "$SECRETS_DIR/.env.development" "SUPABASE_ACCESS_TOKEN" || true)
fi

RESEND_API_KEY=$(get_env_value "$SECRETS_DIR/.env.shared" "RESEND_API_KEY" || true)
SMTP_ADMIN_EMAIL=$(get_env_value "$SECRETS_DIR/.env.shared" "SMTP_ADMIN_EMAIL" || true)
SMTP_SENDER_NAME=$(get_env_value "$SECRETS_DIR/.env.shared" "SMTP_SENDER_NAME" || true)

if [ -z "$DEV_PROJECT_REF" ]; then
    echo -e "${YELLOW}  ⊘ SUPABASE_PROJECT_ID not found in .env.development, skipping${NC}"
elif [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}  ⊘ SUPABASE_ACCESS_TOKEN not found, skipping SMTP configuration${NC}"
    echo -e "${YELLOW}    Add SUPABASE_ACCESS_TOKEN to .env.shared or .env.development${NC}"
else
    configure_smtp "$DEV_PROJECT_REF" "development" "$ACCESS_TOKEN" "$RESEND_API_KEY" "$SMTP_ADMIN_EMAIL" "$SMTP_SENDER_NAME"
fi

echo ""

# ============================================================
# Configure Production SMTP
# ============================================================

echo -e "${BLUE}2. Configuring Production SMTP${NC}"

PROD_PROJECT_REF=$(get_env_value "$SECRETS_DIR/.env.production" "SUPABASE_PROJECT_ID" || true)
if [ -z "$PROD_PROJECT_REF" ]; then
    PROD_PROJECT_REF=$(get_env_value "$SECRETS_DIR/.env.production" "SUPABASE_PROJECT_REF" || true)
fi

# Use production access token if different
if [ -z "$ACCESS_TOKEN" ]; then
    ACCESS_TOKEN=$(get_env_value "$SECRETS_DIR/.env.production" "SUPABASE_ACCESS_TOKEN" || true)
fi

if [ -z "$PROD_PROJECT_REF" ]; then
    echo -e "${YELLOW}  ⊘ SUPABASE_PROJECT_ID not found in .env.production, skipping${NC}"
elif [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}  ⊘ SUPABASE_ACCESS_TOKEN not found, skipping SMTP configuration${NC}"
else
    configure_smtp "$PROD_PROJECT_REF" "production" "$ACCESS_TOKEN" "$RESEND_API_KEY" "$SMTP_ADMIN_EMAIL" "$SMTP_SENDER_NAME"
fi

echo ""

# Print summary
print_summary

exit $?
