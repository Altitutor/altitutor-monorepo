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
    
    if supabase secrets set --project-ref "$project_ref" --env-file "$temp_file" >/dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Supabase Edge Functions ($environment): $secret_name${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}  ✗ Supabase Edge Functions ($environment): $secret_name${NC}"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi
    
    rm -f "$temp_file"
}

# ============================================================
# Deploy Development Secrets
# ============================================================

echo -e "${BLUE}1. Deploying Development Secrets${NC}"
echo -e "${YELLOW}Supabase Development Edge Functions:${NC}"

# Get SUPABASE_PROJECT_REF from development environment
DEV_PROJECT_REF=""
while IFS='=' read -r key value; do
    if [[ "$key" == "SUPABASE_PROJECT_REF" ]]; then
        DEV_PROJECT_REF="$value"
        break
    fi
done < <(parse_env_file "$SECRETS_DIR/.env.development")

if [ -z "$DEV_PROJECT_REF" ]; then
    echo -e "${RED}  ✗ SUPABASE_PROJECT_REF not found in .env.development${NC}"
    echo -e "${YELLOW}  Skipping development deployment${NC}"
else
    # Deploy shared secrets needed by edge functions
    while IFS='=' read -r key value; do
        # Deploy secrets used by edge functions (customize based on your needs)
        # Common patterns: API keys, service credentials, etc.
        if [[ "$key" =~ ^(TWILIO_|STRIPE_SECRET_|RESEND_|SENDGRID_).*$ ]]; then
            deploy_supabase_secret "$key" "$value" "$DEV_PROJECT_REF" "development"
        fi
    done < <(parse_env_file "$SECRETS_DIR/.env.shared")
    
    # Deploy environment-specific secrets needed by edge functions
    while IFS='=' read -r key value; do
        # Skip GitHub, Vercel-specific secrets, and auto-provided Supabase secrets
        # Auto-provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
        if [[ ! "$key" =~ ^(SUPABASE_PROJECT_REF|SUPABASE_DB_PASSWORD|SUPABASE_ACCESS_TOKEN|NEXT_PUBLIC_|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL)$ ]]; then
            # Only deploy secrets that edge functions need
            if [[ "$key" =~ ^(TWILIO_|STRIPE_SECRET_|RESEND_|SENDGRID_).*$ ]]; then
                deploy_supabase_secret "$key" "$value" "$DEV_PROJECT_REF" "development"
            fi
        fi
    done < <(parse_env_file "$SECRETS_DIR/.env.development")
fi

echo ""

# ============================================================
# Deploy Production Secrets
# ============================================================

echo -e "${BLUE}2. Deploying Production Secrets${NC}"
echo -e "${YELLOW}Supabase Production Edge Functions:${NC}"

# Get SUPABASE_PROJECT_REF from production environment
PROD_PROJECT_REF=""
while IFS='=' read -r key value; do
    if [[ "$key" == "SUPABASE_PROJECT_REF" ]]; then
        PROD_PROJECT_REF="$value"
        break
    fi
done < <(parse_env_file "$SECRETS_DIR/.env.production")

if [ -z "$PROD_PROJECT_REF" ]; then
    echo -e "${RED}  ✗ SUPABASE_PROJECT_REF not found in .env.production${NC}"
    echo -e "${YELLOW}  Skipping production deployment${NC}"
else
    # Deploy shared secrets needed by edge functions
    while IFS='=' read -r key value; do
        # Deploy secrets used by edge functions (customize based on your needs)
        if [[ "$key" =~ ^(TWILIO_|STRIPE_SECRET_|RESEND_|SENDGRID_).*$ ]]; then
            deploy_supabase_secret "$key" "$value" "$PROD_PROJECT_REF" "production"
        fi
    done < <(parse_env_file "$SECRETS_DIR/.env.shared")
    
    # Deploy environment-specific secrets needed by edge functions
    while IFS='=' read -r key value; do
        # Skip GitHub, Vercel-specific secrets, and auto-provided Supabase secrets
        if [[ ! "$key" =~ ^(SUPABASE_PROJECT_REF|SUPABASE_DB_PASSWORD|SUPABASE_ACCESS_TOKEN|NEXT_PUBLIC_|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL)$ ]]; then
            # Only deploy secrets that edge functions need
            if [[ "$key" =~ ^(TWILIO_|STRIPE_SECRET_|RESEND_|SENDGRID_).*$ ]]; then
                deploy_supabase_secret "$key" "$value" "$PROD_PROJECT_REF" "production"
            fi
        fi
    done < <(parse_env_file "$SECRETS_DIR/.env.production")
fi

echo ""

# Print summary
print_summary

exit $?



