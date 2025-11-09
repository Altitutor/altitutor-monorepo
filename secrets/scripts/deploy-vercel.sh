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

# Vercel configuration - UPDATE THESE FOR YOUR SETUP
VERCEL_ADMIN_PROJECT="altitutor-admin-dashboard"
VERCEL_STUDENT_PROJECT="altitutor-student-dashboard"
VERCEL_TUTOR_PROJECT="altitutor-tutor-dashboard"

# Get team ID from Vercel CLI or set manually
# Run: vercel teams list
# Or leave empty for personal account
VERCEL_TEAM_ID=""  # e.g., "team_xxxxxx" or leave empty

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Vercel Secret Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check prerequisites
check_command "vercel" "Install with: npm install -g vercel" || exit 1
check_command "jq" "Install with: brew install jq" || exit 1
check_env_file "$SECRETS_DIR/.env.development" || exit 1
check_env_file "$SECRETS_DIR/.env.production" || exit 1

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

# ============================================================
# Deploy Development Secrets (Preview Environment)
# ============================================================

echo -e "${BLUE}1. Deploying Development Secrets (Preview)${NC}"
echo -e "${YELLOW}Vercel Preview Environment:${NC}"

while IFS='=' read -r key value; do
    # Deploy NEXT_PUBLIC_* and other client-side/build-time vars
    if [[ "$key" =~ ^NEXT_PUBLIC_ ]] || [[ "$key" =~ ^(SUPABASE_URL|SUPABASE_ANON_KEY)$ ]]; then
        deploy_vercel_secret "$key" "$value" "$VERCEL_ADMIN_PROJECT" "preview"
        deploy_vercel_secret "$key" "$value" "$VERCEL_STUDENT_PROJECT" "preview"
        deploy_vercel_secret "$key" "$value" "$VERCEL_TUTOR_PROJECT" "preview"
    fi
done < <(parse_env_file "$SECRETS_DIR/.env.development")

echo ""

# ============================================================
# Deploy Production Secrets
# ============================================================

echo -e "${BLUE}2. Deploying Production Secrets${NC}"
echo -e "${YELLOW}Vercel Production Environment:${NC}"

while IFS='=' read -r key value; do
    # Deploy NEXT_PUBLIC_* and other client-side/build-time vars
    if [[ "$key" =~ ^NEXT_PUBLIC_ ]] || [[ "$key" =~ ^(SUPABASE_URL|SUPABASE_ANON_KEY)$ ]]; then
        deploy_vercel_secret "$key" "$value" "$VERCEL_ADMIN_PROJECT" "production"
        deploy_vercel_secret "$key" "$value" "$VERCEL_STUDENT_PROJECT" "production"
        deploy_vercel_secret "$key" "$value" "$VERCEL_TUTOR_PROJECT" "production"
    fi
done < <(parse_env_file "$SECRETS_DIR/.env.production")

echo ""

# Print summary
print_summary

exit $?



