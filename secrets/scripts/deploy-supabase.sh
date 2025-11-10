#!/bin/bash

# ============================================================
# Supabase Secret Deployment Script
# Deploys secrets to Supabase Edge Functions
# ============================================================

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"

# Source common utilities
source "$SCRIPT_DIR/common.sh"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Supabase Secret Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check prerequisites
check_command "supabase" "Install with: brew install supabase/tap/supabase" || exit 1
check_env_file "$SECRETS_DIR/.env.shared" || exit 1
check_env_file "$SECRETS_DIR/.env.development" || exit 1
check_env_file "$SECRETS_DIR/.env.production" || exit 1

echo -e "${GREEN}✓ All prerequisite checks passed${NC}"
echo ""

# Function to deploy a secret to Supabase Edge Functions
deploy_supabase_secret() {
    local secret_name=$1
    local secret_value=$2
    local project_ref=$3
    local environment=$4  # "development" or "production"
    
    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}  ⊘ Skipping $secret_name (empty value)${NC}"
        return
    fi
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    # Set secret using Supabase CLI
    # Create a temporary file to avoid issues with special characters in pipes
    local temp_file=$(mktemp)
    echo "$secret_name=$secret_value" > "$temp_file"
    
    # Change to project root directory (where supabase config might be)
    # Get the monorepo root (go up from secrets/scripts to project root)
    local project_root="$(dirname "$(dirname "$SECRETS_DIR")")"
    
    # Capture error output for debugging
    local error_output=$(cd "$project_root" && supabase secrets set --project-ref "$project_ref" --env-file "$temp_file" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}  ✓ Supabase Edge Functions ($environment): $secret_name${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}  ✗ Supabase Edge Functions ($environment): $secret_name${NC}"
        # Show error message (first line only to avoid clutter)
        if [ -n "$error_output" ]; then
            echo -e "${YELLOW}    Error: $(echo "$error_output" | head -1)${NC}"
        fi
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi
    
    rm -f "$temp_file"
}

# ============================================================
# Deploy Development Secrets
# ============================================================

echo -e "${BLUE}1. Deploying Development Secrets${NC}"
echo -e "${YELLOW}Supabase Development Edge Functions:${NC}"

# Get SUPABASE_PROJECT_ID from development environment
# Use || true to prevent set -e from exiting on failure
DEV_PROJECT_REF=$(get_env_value "$SECRETS_DIR/.env.development" "SUPABASE_PROJECT_ID" || true)

# Also check for SUPABASE_PROJECT_REF (for backward compatibility)
if [ -z "$DEV_PROJECT_REF" ]; then
    DEV_PROJECT_REF=$(get_env_value "$SECRETS_DIR/.env.development" "SUPABASE_PROJECT_REF" || true)
fi

if [ -z "$DEV_PROJECT_REF" ]; then
    echo -e "${RED}  ✗ SUPABASE_PROJECT_ID or SUPABASE_PROJECT_REF not found in .env.development${NC}"
    echo -e "${YELLOW}  Skipping development deployment${NC}"
else
    echo -e "${BLUE}  Deploying to project: $DEV_PROJECT_REF${NC}"
    # Combine base env vars with derived vars
    # Use a temporary file to avoid process substitution issues
    temp_input=$(mktemp) || { echo "Failed to create temp file" >&2; exit 1; }
    {
        parse_env_file "$SECRETS_DIR/.env.shared"
        parse_env_file "$SECRETS_DIR/.env.development"
        derive_env_vars "$SECRETS_DIR/.env.development"
    } > "$temp_input" || { echo "Failed to write to temp file" >&2; rm -f "$temp_input"; exit 1; }
    
    # Read from temp file to avoid subshell issues
    secret_count=0
    while IFS='=' read -r key value || [ -n "$key" ]; do
        secret_count=$((secret_count + 1))
        # Only deploy secrets actually used by edge functions
        # Used: TWILIO_*, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
        # Auto-provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
        # Skip: NEXT_PUBLIC_*, SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD, SUPABASE_ACCESS_TOKEN
        if [[ "$key" =~ ^TWILIO_ ]] || [[ "$key" == "STRIPE_SECRET_KEY" ]] || [[ "$key" == "STRIPE_WEBHOOK_SECRET" ]]; then
            deploy_supabase_secret "$key" "$value" "$DEV_PROJECT_REF" "development"
        fi
    done < "$temp_input"
    
    rm -f "$temp_input"
    # Debug: show how many secrets were processed
    [ "$secret_count" -eq 0 ] && echo -e "${YELLOW}  ⚠ No secrets found to deploy${NC}" >&2 || true
fi

echo ""

# ============================================================
# Deploy Production Secrets
# ============================================================

echo -e "${BLUE}2. Deploying Production Secrets${NC}"
echo -e "${YELLOW}Supabase Production Edge Functions:${NC}"

# Get SUPABASE_PROJECT_ID from production environment
# Use || true to prevent set -e from exiting on failure
PROD_PROJECT_REF=$(get_env_value "$SECRETS_DIR/.env.production" "SUPABASE_PROJECT_ID" || true)

# Also check for SUPABASE_PROJECT_REF (for backward compatibility)
if [ -z "$PROD_PROJECT_REF" ]; then
    PROD_PROJECT_REF=$(get_env_value "$SECRETS_DIR/.env.production" "SUPABASE_PROJECT_REF" || true)
fi

if [ -z "$PROD_PROJECT_REF" ]; then
    echo -e "${RED}  ✗ SUPABASE_PROJECT_ID or SUPABASE_PROJECT_REF not found in .env.production${NC}"
    echo -e "${YELLOW}  Skipping production deployment${NC}"
else
    # Combine base env vars with derived vars
    # Use a temporary file to avoid process substitution issues
    temp_input=$(mktemp)
    {
        parse_env_file "$SECRETS_DIR/.env.shared"
        parse_env_file "$SECRETS_DIR/.env.production"
        derive_env_vars "$SECRETS_DIR/.env.production"
    } > "$temp_input"
    
    # Read from temp file to avoid subshell issues
    while IFS='=' read -r key value; do
        # Only deploy secrets actually used by edge functions
        # Used: TWILIO_*, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
        # Auto-provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
        # Skip: NEXT_PUBLIC_*, SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD, SUPABASE_ACCESS_TOKEN
        if [[ "$key" =~ ^TWILIO_ ]] || [[ "$key" == "STRIPE_SECRET_KEY" ]] || [[ "$key" == "STRIPE_WEBHOOK_SECRET" ]]; then
            deploy_supabase_secret "$key" "$value" "$PROD_PROJECT_REF" "production"
        fi
    done < "$temp_input"
    
    rm -f "$temp_input"
fi

echo ""

# Print summary
print_summary

exit $?






