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

# GitHub org and repo - UPDATE THIS FOR YOUR REPOSITORY
GITHUB_REPO="matthewchua/altitutor-monorepo"  # Change to your-org/your-repo

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
    
    if [ "$target" = "repo" ]; then
        if echo "$secret_value" | gh secret set "$secret_name" --repo "$GITHUB_REPO" 2>/dev/null; then
            echo -e "${GREEN}  ✓ GitHub (repo): $secret_name${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo -e "${RED}  ✗ GitHub (repo): $secret_name${NC}"
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
        fi
    else
        if echo "$secret_value" | gh secret set "$secret_name" --repo "$GITHUB_REPO" --env "$target" 2>/dev/null; then
            echo -e "${GREEN}  ✓ GitHub ($target): $secret_name${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo -e "${RED}  ✗ GitHub ($target): $secret_name${NC}"
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

while IFS='=' read -r key value; do
    # Skip Vercel-specific secrets (NEXT_PUBLIC_*) for GitHub
    if [[ ! "$key" =~ ^NEXT_PUBLIC_ ]]; then
        deploy_github_secret "$key" "$value" "development"
    fi
done < <(parse_env_file "$SECRETS_DIR/.env.development")

echo ""

# ============================================================
# Deploy Production Secrets
# ============================================================

echo -e "${BLUE}3. Deploying Production Secrets${NC}"
echo -e "${YELLOW}GitHub Production Environment:${NC}"

while IFS='=' read -r key value; do
    # Skip Vercel-specific secrets (NEXT_PUBLIC_*) for GitHub
    if [[ ! "$key" =~ ^NEXT_PUBLIC_ ]]; then
        deploy_github_secret "$key" "$value" "production"
    fi
done < <(parse_env_file "$SECRETS_DIR/.env.production")

echo ""

# ============================================================
# Verify Deployment
# ============================================================

echo -e "${BLUE}4. Verifying Deployment${NC}"
echo -e "${YELLOW}Verifying GitHub Secrets:${NC}"

# Count repository secrets
repo_secrets=$(gh secret list --repo "$GITHUB_REPO" 2>/dev/null | wc -l | xargs)
echo -e "${GREEN}  ✓ Repository secrets:       $repo_secrets found${NC}"

# Check if environments exist
if gh api repos/"$GITHUB_REPO"/environments/development &>/dev/null; then
    echo -e "${GREEN}  ✓ Development environment exists${NC}"
else
    echo -e "${YELLOW}  ⚠ Development environment not found (will be created on first use)${NC}"
fi

if gh api repos/"$GITHUB_REPO"/environments/production &>/dev/null; then
    echo -e "${GREEN}  ✓ Production environment exists${NC}"
else
    echo -e "${YELLOW}  ⚠ Production environment not found (will be created on first use)${NC}"
fi

# Print summary
print_summary

exit $?

