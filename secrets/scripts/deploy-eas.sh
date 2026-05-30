#!/bin/bash

# ============================================================
# EAS (Expo) Secret Deployment Script
# Deploys client env vars to EAS environments for student-app
# ============================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(dirname "$SECRETS_DIR")"
STUDENT_APP_DIR="$MONOREPO_ROOT/apps/student-app"

source "$SCRIPT_DIR/common.sh"

# Load EXPO_TOKEN from .env.shared if it exists
if [ -f "$SECRETS_DIR/.env.shared" ]; then
    while IFS='=' read -r key value || [ -n "$key" ]; do
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        if [ "$key" = "EXPO_TOKEN" ] && [ -n "$value" ]; then
            export EXPO_TOKEN="$value"
            break
        fi
    done < "$SECRETS_DIR/.env.shared"
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}EAS (Expo) Secret Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

check_command "eas" "Install with: npm install -g eas-cli" || exit 1
check_env_file "$SECRETS_DIR/.env.development" || exit 1
check_env_file "$SECRETS_DIR/.env.production" || exit 1

if [ ! -f "$STUDENT_APP_DIR/eas.json" ]; then
    echo -e "${RED}❌ student-app eas.json not found at $STUDENT_APP_DIR${NC}"
    exit 1
fi

if [ -n "$EXPO_TOKEN" ]; then
    echo -e "${GREEN}✓ Expo token loaded from .env.shared${NC}"
else
    echo -e "${YELLOW}⚠ EXPO_TOKEN not found in .env.shared, will try EAS CLI auth${NC}"
fi

echo -e "${GREEN}✓ All prerequisite checks passed${NC}"
echo ""

# Build a temp .env file containing only EXPO_PUBLIC_* variables for EAS
build_expo_env_file() {
    local source_env=$1
    local output_file=$2

    : > "$output_file"

    while IFS='=' read -r key value; do
        if [[ "$key" =~ ^EXPO_PUBLIC_ ]] && [ -n "$value" ]; then
            echo "$key=$value" >> "$output_file"
        fi
    done < <({
        parse_env_file "$source_env"
        parse_env_file "$SECRETS_DIR/.env.shared"
        derive_env_vars "$source_env"
        derive_expo_env_vars "$source_env"
    } | awk -F= '!seen[$1]++')
}

deploy_eas_environment() {
    local eas_environment=$1
    local source_env=$2
    local tmp_file

    tmp_file="$(mktemp)"
    build_expo_env_file "$source_env" "$tmp_file"

    if [ ! -s "$tmp_file" ]; then
        echo -e "${YELLOW}  ⊘ Skipping EAS ($eas_environment): no EXPO_PUBLIC_* variables found${NC}"
        rm -f "$tmp_file"
        return
    fi

    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    echo -e "${YELLOW}  → EAS ($eas_environment):${NC}"
    while IFS='=' read -r key _; do
        [[ -z "$key" ]] && continue
        echo -e "    ${BLUE}•${NC} $key"
    done < "$tmp_file"

    if (
        cd "$STUDENT_APP_DIR"
        eas env:push "$eas_environment" --path "$tmp_file" --force
    ); then
        echo -e "${GREEN}  ✓ EAS ($eas_environment): pushed $(wc -l < "$tmp_file" | xargs) variable(s)${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}  ✗ EAS ($eas_environment): push failed${NC}"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi

    rm -f "$tmp_file"
}

echo -e "${BLUE}1. Deploying Development Secrets${NC}"
echo -e "${YELLOW}EAS development + preview environments:${NC}"
deploy_eas_environment "development" "$SECRETS_DIR/.env.development"
deploy_eas_environment "preview" "$SECRETS_DIR/.env.development"

echo ""

echo -e "${BLUE}2. Deploying Production Secrets${NC}"
echo -e "${YELLOW}EAS production environment:${NC}"
deploy_eas_environment "production" "$SECRETS_DIR/.env.production"

echo ""

print_summary

exit $?
