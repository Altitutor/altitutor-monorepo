#!/bin/bash

# ============================================================
# EAS (Expo) Secret Deployment Script
# Deploys client env vars to EAS environments for native apps
# ============================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(dirname "$SECRETS_DIR")"
STUDENT_APP_DIR="$MONOREPO_ROOT/apps/student-app"
UCAT_APP_DIR="$MONOREPO_ROOT/apps/ucat-app"

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

if [ ! -f "$UCAT_APP_DIR/eas.json" ]; then
    echo -e "${RED}❌ ucat-app eas.json not found at $UCAT_APP_DIR${NC}"
    exit 1
fi

if [ -n "$EXPO_TOKEN" ]; then
    echo -e "${GREEN}✓ Expo token loaded from .env.shared${NC}"
else
    echo -e "${YELLOW}⚠ EXPO_TOKEN not found in .env.shared, will try EAS CLI auth${NC}"
fi

echo -e "${GREEN}✓ All prerequisite checks passed${NC}"
echo ""

# Build a temp .env file containing only EXPO_PUBLIC_* variables for student-app
build_student_expo_env_file() {
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

build_ucat_expo_env_file() {
    local source_env=$1
    local eas_environment=$2
    local output_file=$3

    : > "$output_file"

    while IFS='=' read -r key value; do
        if [[ "$key" =~ ^(EXPO_PUBLIC_|SENTRY_) ]] && [ -n "$value" ]; then
            echo "$key=$value" >> "$output_file"
        fi
    done < <({
        derive_ucat_expo_env_vars "$source_env" "$eas_environment"
    } | awk -F= '!seen[$1]++')
}

deploy_eas_environment() {
    local app_dir=$1
    local app_label=$2
    local eas_environment=$3
    local tmp_file=$4

    if [ ! -s "$tmp_file" ]; then
        echo -e "${YELLOW}  ⊘ Skipping $app_label EAS ($eas_environment): no variables found${NC}"
        rm -f "$tmp_file"
        return
    fi

    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    echo -e "${YELLOW}  → $app_label EAS ($eas_environment):${NC}"
    while IFS='=' read -r key _; do
        [[ -z "$key" ]] && continue
        echo -e "    ${BLUE}•${NC} $key"
    done < "$tmp_file"

    if (
        cd "$app_dir"
        eas env:push "$eas_environment" --path "$tmp_file" --force
    ); then
        echo -e "${GREEN}  ✓ $app_label EAS ($eas_environment): pushed $(wc -l < "$tmp_file" | xargs) variable(s)${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}  ✗ $app_label EAS ($eas_environment): push failed${NC}"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi

    rm -f "$tmp_file"
}

deploy_student_eas_environment() {
    local eas_environment=$1
    local source_env=$2
    local tmp_file

    tmp_file="$(mktemp)"
    build_student_expo_env_file "$source_env" "$tmp_file"
    deploy_eas_environment "$STUDENT_APP_DIR" "student-app" "$eas_environment" "$tmp_file"
}

deploy_ucat_eas_environment() {
    local eas_environment=$1
    local source_env=$2
    local tmp_file

    tmp_file="$(mktemp)"
    build_ucat_expo_env_file "$source_env" "$eas_environment" "$tmp_file"
    deploy_eas_environment "$UCAT_APP_DIR" "ucat-app" "$eas_environment" "$tmp_file"
}

echo -e "${BLUE}1. Deploying student-app secrets${NC}"
echo -e "${YELLOW}EAS development + preview environments:${NC}"
deploy_student_eas_environment "development" "$SECRETS_DIR/.env.development"
deploy_student_eas_environment "preview" "$SECRETS_DIR/.env.development"

echo ""

echo -e "${BLUE}2. Deploying student-app production secrets${NC}"
echo -e "${YELLOW}EAS production environment:${NC}"
deploy_student_eas_environment "production" "$SECRETS_DIR/.env.production"

echo ""

UCAT_EAS_PROJECT_ID="$(eas_project_id "$UCAT_APP_DIR")"
if [ -z "$UCAT_EAS_PROJECT_ID" ]; then
    echo -e "${YELLOW}⊘ Skipping ucat-app EAS env: register the project first with${NC}"
    echo -e "${YELLOW}  cd apps/ucat-app && eas init${NC}"
else
    echo -e "${BLUE}3. Deploying ucat-app secrets${NC}"
    echo -e "${YELLOW}EAS development + preview environments:${NC}"
    deploy_ucat_eas_environment "development" "$SECRETS_DIR/.env.development"
    deploy_ucat_eas_environment "preview" "$SECRETS_DIR/.env.development"

    echo ""

    echo -e "${BLUE}4. Deploying ucat-app production secrets${NC}"
    echo -e "${YELLOW}EAS production environment:${NC}"
    deploy_ucat_eas_environment "production" "$SECRETS_DIR/.env.production"
fi

echo ""

print_summary

exit $?
