#!/bin/bash

# ============================================================
# Vercel Secret Deployment Script
# Deploys secrets to Vercel projects (preview + production)
# ============================================================

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"

# Source common utilities
source "$SCRIPT_DIR/common.sh"

# Load VERCEL_TOKEN from .env.shared if it exists
if [ -f "$SECRETS_DIR/.env.shared" ]; then
    # Extract VERCEL_TOKEN from .env.shared and export it
    # Read directly from file, skipping comments and empty lines
    while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip empty lines and comments
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
        # Remove leading/trailing whitespace and quotes
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        if [ "$key" = "VERCEL_TOKEN" ] && [ -n "$value" ]; then
            export VERCEL_TOKEN="$value"
            break
        fi
    done < "$SECRETS_DIR/.env.shared"
fi

# Vercel configuration - UPDATE THESE FOR YOUR SETUP
VERCEL_ADMIN_PROJECT="altitutor-admin-web"
VERCEL_MARKETING_PROJECT="altitutor-marketing-web"
VERCEL_STUDENT_PROJECT="altitutor-student-web"
VERCEL_TUTOR_PROJECT="altitutor-tutor-web"
VERCEL_UCAT_PROJECT="altitutor-ucat-web"

# Get team ID from Vercel CLI or set manually
# Run: vercel teams list
# Or leave empty for personal account
VERCEL_TEAM_ID="team_1E1lzurM2oIC9oDKmQDdk7Bz"  # e.g., "team_xxxxxx" or leave empty

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Vercel Secret Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check prerequisites
check_command "vercel" "Install with: npm install -g vercel" || exit 1
check_command "jq" "Install with: brew install jq" || exit 1
check_env_file "$SECRETS_DIR/.env.development" || exit 1
check_env_file "$SECRETS_DIR/.env.production" || exit 1

# Verify Vercel token is loaded
if [ -n "$VERCEL_TOKEN" ]; then
    echo -e "${GREEN}✓ Vercel token loaded from .env.shared${NC}"
else
    echo -e "${YELLOW}⚠ Vercel token not found in .env.shared, will try CLI auth${NC}"
fi

echo -e "${GREEN}✓ All prerequisite checks passed${NC}"
echo ""

# Function to get Vercel Auth Token
get_vercel_token() {
    # First, check if VERCEL_TOKEN environment variable is set
    if [ -n "$VERCEL_TOKEN" ]; then
        echo "$VERCEL_TOKEN"
        return
    fi
    
    # Try to get token from Vercel CLI config (modern location)
    local token_file="$HOME/Library/Application Support/com.vercel.cli/auth.json"
    if [ -f "$token_file" ]; then
        # Extract token from auth.json (handles spaces around colon)
        TOKEN=$(cat "$token_file" | grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 | head -1)
        echo "$TOKEN"
        return
    fi
    
    # Try legacy location
    token_file="$HOME/.vercel/auth.json"
    if [ -f "$token_file" ]; then
        # Extract token from auth.json (handles spaces around colon)
        TOKEN=$(cat "$token_file" | grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 | head -1)
        echo "$TOKEN"
        return
    fi
    
    echo ""
}

# Function to get Vercel Project ID by name
get_vercel_project_id() {
    local project_name=$1
    local team_id=$2
    local token=$3
    
    # Build URL with optional team parameter
    local url="https://api.vercel.com/v9/projects/$project_name"
    if [ -n "$team_id" ]; then
        url="$url?teamId=$team_id"
    fi
    
    # Use Vercel API to get project info
    local response=$(curl -s -H "Authorization: Bearer $token" "$url")
    
    # Extract project ID from response using jq
    local project_id=$(echo "$response" | jq -r '.id // empty')
    
    echo "$project_id"
}

# Function to deploy a secret to Vercel using REST API
deploy_vercel_secret() {
    local secret_name=$1
    local secret_value=$2
    local project=$3
    local environment=$4  # "preview" or "production"
    
    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}  ⊘ Skipping $secret_name (empty value)${NC}"
        return
    fi
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    # Get Vercel token
    local token=$(get_vercel_token)
    if [ -z "$token" ]; then
        echo -e "${RED}  ✗ Vercel ($project - $environment): $secret_name (no auth token)${NC}"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        return
    fi
    
    # Get project ID
    local project_id=$(get_vercel_project_id "$project" "$VERCEL_TEAM_ID" "$token")
    if [ -z "$project_id" ]; then
        echo -e "${RED}  ✗ Vercel ($project - $environment): $secret_name (project not found)${NC}"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        return
    fi
    
    # Build URL with optional team parameter
    local url="https://api.vercel.com/v10/projects/$project_id/env?upsert=true"
    if [ -n "$VERCEL_TEAM_ID" ]; then
        url="$url&teamId=$VERCEL_TEAM_ID"
    fi
    
    # Use Vercel API to set environment variable
    local response=$(curl -s -X POST \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{\"key\":\"$secret_name\",\"value\":\"$secret_value\",\"type\":\"encrypted\",\"target\":[\"$environment\"]}" \
        "$url")
    
    # Check if request was successful
    if echo "$response" | grep -q '"created"' || echo "$response" | grep -q '"updated"'; then
        echo -e "${GREEN}  ✓ Vercel ($project - $environment): $secret_name${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}  ✗ Vercel ($project - $environment): $secret_name${NC}"
        if [ -n "$DEBUG_VERCEL" ]; then
            echo "    Response: $response" >&2
        fi
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi
}

deploy_tutor_web_server_secret() {
    local secret_name=$1
    local secret_value=$2
    local environment=$3

    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_TUTOR_PROJECT" "$environment"
}

deploy_admin_and_tutor_web_server_secret() {
    local secret_name=$1
    local secret_value=$2
    local environment=$3

    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_ADMIN_PROJECT" "$environment"
    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_TUTOR_PROJECT" "$environment"
}

deploy_all_web_server_secret() {
    local secret_name=$1
    local secret_value=$2
    local environment=$3

    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_ADMIN_PROJECT" "$environment"
    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_STUDENT_PROJECT" "$environment"
    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_TUTOR_PROJECT" "$environment"
    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_UCAT_PROJECT" "$environment"
}

deploy_ucat_web_server_config() {
    local config_name=$1
    local config_value=$2
    local environment=$3

    deploy_vercel_secret "$config_name" "$config_value" "$VERCEL_UCAT_PROJECT" "$environment"
}

deploy_sentry_project() {
    local env_file=$1
    local source_prefix=$2
    local vercel_project=$3
    local environment=$4
    local runtime_dsn_name=${5:-NEXT_PUBLIC_SENTRY_DSN}

    local dsn=$(get_env_value "$env_file" "${source_prefix}_SENTRY_DSN" || true)
    local sentry_project=$(get_env_value "$env_file" "${source_prefix}_SENTRY_PROJECT" || true)

    # Do not distribute shared build credentials until this app has its own
    # Sentry project configured.
    if [ -z "$dsn" ] && [ -z "$sentry_project" ]; then
        return
    fi

    local sentry_org=$(get_env_value "$env_file" "SENTRY_ORG" || true)
    local auth_token=$(get_env_value "$env_file" "SENTRY_AUTH_TOKEN" || true)

    deploy_vercel_secret "$runtime_dsn_name" "$dsn" "$vercel_project" "$environment"
    deploy_vercel_secret "SENTRY_PROJECT" "$sentry_project" "$vercel_project" "$environment"
    deploy_vercel_secret "SENTRY_ORG" "$sentry_org" "$vercel_project" "$environment"
    deploy_vercel_secret "SENTRY_AUTH_TOKEN" "$auth_token" "$vercel_project" "$environment"
    deploy_vercel_secret "NEXT_PUBLIC_SENTRY_ENVIRONMENT" "$environment" "$vercel_project" "$environment"
    deploy_vercel_secret "SENTRY_ENVIRONMENT" "$environment" "$vercel_project" "$environment"
}

deploy_public_analytics_secret() {
    local secret_name=$1
    local secret_value=$2
    local environment=$3

    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_MARKETING_PROJECT" "$environment"
    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_STUDENT_PROJECT" "$environment"
    deploy_vercel_secret "$secret_name" "$secret_value" "$VERCEL_UCAT_PROJECT" "$environment"
}

# ============================================================
# Deploy Development Secrets (Preview Environment)
# ============================================================

echo -e "${BLUE}1. Deploying Development Secrets (Preview)${NC}"
echo -e "${YELLOW}Vercel Preview Environment:${NC}"

deploy_sentry_project "$SECRETS_DIR/.env.development" "ADMIN_WEB" "$VERCEL_ADMIN_PROJECT" "preview"
deploy_sentry_project "$SECRETS_DIR/.env.development" "MARKETING_WEB" "$VERCEL_MARKETING_PROJECT" "preview"
deploy_sentry_project "$SECRETS_DIR/.env.development" "STUDENT_WEB" "$VERCEL_STUDENT_PROJECT" "preview"
deploy_sentry_project "$SECRETS_DIR/.env.development" "TUTOR_WEB" "$VERCEL_TUTOR_PROJECT" "preview"
deploy_sentry_project "$SECRETS_DIR/.env.development" "UCAT_WEB" "$VERCEL_UCAT_PROJECT" "preview"

# Combine base env vars with derived vars
while IFS='=' read -r key value; do
    # Deploy NEXT_PUBLIC_* variables (including derived ones)
    if [[ "$key" =~ ^NEXT_PUBLIC_POSTHOG_ ]]; then
        deploy_public_analytics_secret "$key" "$value" "preview"
    elif [[ "$key" =~ ^NEXT_PUBLIC_ ]]; then
        deploy_vercel_secret "$key" "$value" "$VERCEL_ADMIN_PROJECT" "preview"
        deploy_vercel_secret "$key" "$value" "$VERCEL_STUDENT_PROJECT" "preview"
        deploy_vercel_secret "$key" "$value" "$VERCEL_TUTOR_PROJECT" "preview"
        deploy_vercel_secret "$key" "$value" "$VERCEL_UCAT_PROJECT" "preview"
    # Deploy UCAT server-rendered social sign-in feature flags.
    elif [[ "$key" =~ ^AUTH_(GOOGLE|APPLE)_ENABLED$ ]]; then
        deploy_ucat_web_server_config "$key" "$value" "preview"
    # Deploy server-side secrets needed for API routes
    elif [[ "$key" == "SUPABASE_SERVICE_ROLE_KEY" ]] || [[ "$key" == "SUPABASE_SECRET_KEY" ]]; then
        deploy_vercel_secret "$key" "$value" "$VERCEL_ADMIN_PROJECT" "preview"
        deploy_vercel_secret "$key" "$value" "$VERCEL_STUDENT_PROJECT" "preview"
        deploy_vercel_secret "$key" "$value" "$VERCEL_TUTOR_PROJECT" "preview"
        deploy_vercel_secret "$key" "$value" "$VERCEL_UCAT_PROJECT" "preview"
    # Deploy tutor-web-only server secrets
    elif [[ "$key" == "OPENROUTER_API_KEY" ]]; then
        deploy_tutor_web_server_secret "$key" "$value" "preview"
    # Deploy UCAT Codex OAuth encryption key where tokens are encrypted/decrypted
    elif [[ "$key" == "UCAT_CODEX_OAUTH_ENCRYPTION_KEY" ]]; then
        deploy_admin_and_tutor_web_server_secret "$key" "$value" "preview"
    # Deploy server-side email secrets used by app API routes
    elif [[ "$key" == "RESEND_API_KEY" ]]; then
        deploy_all_web_server_secret "$key" "$value" "preview"
    fi
done < <({
    parse_env_file "$SECRETS_DIR/.env.development"
    parse_env_file "$SECRETS_DIR/.env.shared"
    derive_env_vars "$SECRETS_DIR/.env.development"
})

echo ""

# ============================================================
# Deploy Production Secrets
# ============================================================

echo -e "${BLUE}2. Deploying Production Secrets${NC}"
echo -e "${YELLOW}Vercel Production Environment:${NC}"

deploy_sentry_project "$SECRETS_DIR/.env.production" "ADMIN_WEB" "$VERCEL_ADMIN_PROJECT" "production"
deploy_sentry_project "$SECRETS_DIR/.env.production" "MARKETING_WEB" "$VERCEL_MARKETING_PROJECT" "production"
deploy_sentry_project "$SECRETS_DIR/.env.production" "STUDENT_WEB" "$VERCEL_STUDENT_PROJECT" "production"
deploy_sentry_project "$SECRETS_DIR/.env.production" "TUTOR_WEB" "$VERCEL_TUTOR_PROJECT" "production"
deploy_sentry_project "$SECRETS_DIR/.env.production" "UCAT_WEB" "$VERCEL_UCAT_PROJECT" "production"

# Combine base env vars with derived vars
while IFS='=' read -r key value; do
    # Deploy NEXT_PUBLIC_* variables (including derived ones)
    if [[ "$key" =~ ^NEXT_PUBLIC_POSTHOG_ ]]; then
        deploy_public_analytics_secret "$key" "$value" "production"
    elif [[ "$key" =~ ^NEXT_PUBLIC_ ]]; then
        deploy_vercel_secret "$key" "$value" "$VERCEL_ADMIN_PROJECT" "production"
        deploy_vercel_secret "$key" "$value" "$VERCEL_STUDENT_PROJECT" "production"
        deploy_vercel_secret "$key" "$value" "$VERCEL_TUTOR_PROJECT" "production"
        deploy_vercel_secret "$key" "$value" "$VERCEL_UCAT_PROJECT" "production"
    # Deploy UCAT server-rendered social sign-in feature flags.
    elif [[ "$key" =~ ^AUTH_(GOOGLE|APPLE)_ENABLED$ ]]; then
        deploy_ucat_web_server_config "$key" "$value" "production"
    # Deploy server-side secrets needed for API routes
    elif [[ "$key" == "SUPABASE_SERVICE_ROLE_KEY" ]] || [[ "$key" == "SUPABASE_SECRET_KEY" ]]; then
        deploy_vercel_secret "$key" "$value" "$VERCEL_ADMIN_PROJECT" "production"
        deploy_vercel_secret "$key" "$value" "$VERCEL_STUDENT_PROJECT" "production"
        deploy_vercel_secret "$key" "$value" "$VERCEL_TUTOR_PROJECT" "production"
        deploy_vercel_secret "$key" "$value" "$VERCEL_UCAT_PROJECT" "production"
    # Deploy tutor-web-only server secrets
    elif [[ "$key" == "OPENROUTER_API_KEY" ]]; then
        deploy_tutor_web_server_secret "$key" "$value" "production"
    # Deploy UCAT Codex OAuth encryption key where tokens are encrypted/decrypted
    elif [[ "$key" == "UCAT_CODEX_OAUTH_ENCRYPTION_KEY" ]]; then
        deploy_admin_and_tutor_web_server_secret "$key" "$value" "production"
    # Deploy server-side email secrets used by app API routes
    elif [[ "$key" == "RESEND_API_KEY" ]]; then
        deploy_all_web_server_secret "$key" "$value" "production"
    fi
done < <({
    parse_env_file "$SECRETS_DIR/.env.production"
    parse_env_file "$SECRETS_DIR/.env.shared"
    derive_env_vars "$SECRETS_DIR/.env.production"
})

echo ""

# Print summary
print_summary

exit $?
