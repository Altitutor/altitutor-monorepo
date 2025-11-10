#!/bin/bash

# ============================================================
# GitHub Secret Deployment Script
# Deploys secrets to GitHub Actions (repository + environments)
# ============================================================

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"

# Source common utilities
source "$SCRIPT_DIR/common.sh"

# Ensure Homebrew is in PATH (for GitHub CLI)
if [ -f "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)" >/dev/null 2>&1
fi

# GitHub org and repo - UPDATE THIS FOR YOUR REPOSITORY
GITHUB_REPO="Altitutor/altitutor-monorepo"  # Change to your-org/your-repo

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}GitHub Secret Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check prerequisites
check_command "gh" "Install with: brew install gh" || exit 1
check_env_file "$SECRETS_DIR/.env.shared" || exit 1
check_env_file "$SECRETS_DIR/.env.development" || exit 1
check_env_file "$SECRETS_DIR/.env.production" || exit 1

echo -e "${GREEN}✓ All prerequisite checks passed${NC}"
echo ""

# Function to deploy a secret to GitHub
deploy_github_secret() {
    local secret_name=$1
    local secret_value=$2
    local target=$3  # "repo", "development", or "production"
    
    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}  ⊘ Skipping $secret_name (empty value)${NC}"
        return
    fi
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    # Ensure gh is in PATH
    if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)" >/dev/null 2>&1
    fi
    
    # Find gh command
    local gh_cmd=$(command -v gh)
    if [ -z "$gh_cmd" ]; then
        echo -e "${RED}  ✗ GitHub ($target): $secret_name (gh command not found)${NC}"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        return
    fi
    
    # Capture error output
    local error_output=""
    if [ "$target" = "repo" ]; then
        error_output=$(echo "$secret_value" | "$gh_cmd" secret set "$secret_name" --repo "$GITHUB_REPO" 2>&1)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}  ✓ GitHub (repo): $secret_name${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo -e "${RED}  ✗ GitHub (repo): $secret_name${NC}"
            # Show error message
            if echo "$error_output" | grep -q "404\|Not Found"; then
                echo -e "${YELLOW}    Note: 404 error - GitHub Actions may not be enabled or you may need admin access${NC}"
            else
                echo -e "${YELLOW}    Error: $(echo "$error_output" | head -1)${NC}"
            fi
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
        fi
    else
        error_output=$(echo "$secret_value" | "$gh_cmd" secret set "$secret_name" --repo "$GITHUB_REPO" --env "$target" 2>&1)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}  ✓ GitHub ($target): $secret_name${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo -e "${RED}  ✗ GitHub ($target): $secret_name${NC}"
            # Show error message
            if echo "$error_output" | grep -q "404\|Not Found"; then
                echo -e "${YELLOW}    Note: 404 error - Environment may not exist or Actions may not be enabled${NC}"
            else
                echo -e "${YELLOW}    Error: $(echo "$error_output" | head -1)${NC}"
            fi
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
        fi
    fi
}

# ============================================================
# Deploy Shared Secrets (Repository Level)
# ============================================================

echo -e "${BLUE}1. Deploying Shared Secrets to GitHub Repository${NC}"
while IFS='=' read -r key value; do
    deploy_github_secret "$key" "$value" "repo"
done < <(parse_env_file "$SECRETS_DIR/.env.shared")

echo ""

# ============================================================
# Deploy Development Secrets
# ============================================================

echo -e "${BLUE}2. Deploying Development Secrets${NC}"
echo -e "${YELLOW}GitHub Development Environment:${NC}"

# Combine base env vars with shared vars
# Note: We derive SUPABASE_PROJECT_ID from SUPABASE_PROJECT_REF if needed
{
    parse_env_file "$SECRETS_DIR/.env.shared"
    parse_env_file "$SECRETS_DIR/.env.development"
} | while IFS='=' read -r key value; do
    # Skip Vercel-specific secrets (NEXT_PUBLIC_*) for GitHub
    # Also skip derived vars that are only for Vercel
    if [[ ! "$key" =~ ^NEXT_PUBLIC_ ]]; then
        # Map SUPABASE_PROJECT_REF to SUPABASE_PROJECT_ID for consistency
        if [[ "$key" == "SUPABASE_PROJECT_REF" ]]; then
            deploy_github_secret "SUPABASE_PROJECT_ID" "$value" "development"
        else
            deploy_github_secret "$key" "$value" "development"
        fi
    fi
done

echo ""

# ============================================================
# Deploy Production Secrets
# ============================================================

echo -e "${BLUE}3. Deploying Production Secrets${NC}"
echo -e "${YELLOW}GitHub Production Environment:${NC}"

# Combine base env vars with shared vars
# Note: We derive SUPABASE_PROJECT_ID from SUPABASE_PROJECT_REF if needed
{
    parse_env_file "$SECRETS_DIR/.env.shared"
    parse_env_file "$SECRETS_DIR/.env.production"
} | while IFS='=' read -r key value; do
    # Skip Vercel-specific secrets (NEXT_PUBLIC_*) for GitHub
    # Also skip derived vars that are only for Vercel
    if [[ ! "$key" =~ ^NEXT_PUBLIC_ ]]; then
        # Map SUPABASE_PROJECT_REF to SUPABASE_PROJECT_ID for consistency
        if [[ "$key" == "SUPABASE_PROJECT_REF" ]]; then
            deploy_github_secret "SUPABASE_PROJECT_ID" "$value" "production"
        else
            deploy_github_secret "$key" "$value" "production"
        fi
    fi
done

echo ""

# ============================================================
# Verify Deployment
# ============================================================

echo -e "${BLUE}4. Verifying Deployment${NC}"
echo -e "${YELLOW}Verifying GitHub Secrets:${NC}"

# Ensure gh is in PATH for verification
if [ -f "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)" >/dev/null 2>&1
fi
gh_cmd=$(command -v gh)

# Count repository secrets
if [ -n "$gh_cmd" ]; then
    repo_secrets=$("$gh_cmd" secret list --repo "$GITHUB_REPO" 2>/dev/null | wc -l | xargs)
    echo -e "${GREEN}  ✓ Repository secrets:       $repo_secrets found${NC}"
    
    # Check if environments exist
    if "$gh_cmd" api repos/"$GITHUB_REPO"/environments/development &>/dev/null; then
        echo -e "${GREEN}  ✓ Development environment exists${NC}"
    else
        echo -e "${YELLOW}  ⚠ Development environment not found (will be created on first use)${NC}"
    fi
    
    if "$gh_cmd" api repos/"$GITHUB_REPO"/environments/production &>/dev/null; then
        echo -e "${GREEN}  ✓ Production environment exists${NC}"
    else
        echo -e "${YELLOW}  ⚠ Production environment not found (will be created on first use)${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Could not verify secrets (gh command not found)${NC}"
fi

# Print summary
print_summary

exit $?




