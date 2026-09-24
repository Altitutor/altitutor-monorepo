#!/bin/bash

# ============================================================
# Common Utilities for Secret Deployment Scripts
# Shared functions, colors, and utilities
# ============================================================

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

# Counters (can be imported by other scripts)
export SUCCESS_COUNT=0
export FAILURE_COUNT=0
export TOTAL_COUNT=0

# Function to parse .env file
parse_env_file() {
    local file=$1
    while IFS='=' read -r key value; do
        # Skip empty lines and comments
        [[ -z "$key" || "$key" =~ ^#.*$ ]] && continue
        # Remove leading/trailing whitespace and quotes
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        echo "$key=$value"
    done < "$file"
}

# Function to check if a command exists
check_command() {
    local cmd=$1
    local install_hint=$2
    
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}❌ $cmd is not installed${NC}"
        if [ -n "$install_hint" ]; then
            echo -e "${YELLOW}$install_hint${NC}"
        fi
        return 1
    fi
    return 0
}

# Function to check if .env file exists
check_env_file() {
    local file=$1
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ $file not found${NC}"
        return 1
    fi
    return 0
}

# Function to print deployment summary
print_summary() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}Deployment Summary${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo "Total operations: $TOTAL_COUNT"
    
    if [ $FAILURE_COUNT -eq 0 ]; then
        echo -e "${GREEN}All secrets deployed successfully! ✓${NC}"
        return 0
    else
        echo -e "${GREEN}Successful: $SUCCESS_COUNT${NC}"
        echo -e "${RED}Failed: $FAILURE_COUNT${NC}"
        echo ""
        echo -e "${RED}✗ Some secrets failed to deploy. Please check the errors above.${NC}"
        return 1
    fi
}

# Function to derive environment variables from base secrets
# This function takes a parsed env file and outputs derived variables
derive_env_vars() {
    local env_file=$1
    local project_ref=""
    local publishable_key=""
    local secret_key=""
    local stripe_publishable=""
    local ucat_url=""
    
    # Read base values from env file
    while IFS='=' read -r key value; do
        case "$key" in
            SUPABASE_PROJECT_REF|SUPABASE_PROJECT_ID)
                project_ref="$value"
                ;;
            SUPABASE_PUBLISHABLE_KEY)
                publishable_key="$value"
                ;;
            SUPABASE_SECRET_KEY)
                secret_key="$value"
                ;;
            STRIPE_PUBLISHABLE_KEY)
                stripe_publishable="$value"
                ;;
            UCAT_WEB_URL|NEXT_PUBLIC_UCAT_URL|NEXT_PUBLIC_UCAT_WEB_URL|NEXT_PUBLIC_UCAT_APP_ORIGIN)
                ucat_url="$value"
                ;;
        esac
    done < <(parse_env_file "$env_file")
    
    # Derive NEXT_PUBLIC_SUPABASE_URL from project ref
    if [ -n "$project_ref" ]; then
        echo "NEXT_PUBLIC_SUPABASE_URL=https://${project_ref}.supabase.co"
    fi
    
    # Derive NEXT_PUBLIC_SUPABASE_ANON_KEY from publishable key
    # Also support SUPABASE_PUBLISHABLE_KEY -> SUPABASE_ANON_KEY for backward compatibility
    if [ -n "$publishable_key" ]; then
        echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${publishable_key}"
        echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable_key}"
        # For backward compatibility with code that uses SUPABASE_SERVICE_ROLE_KEY
        echo "SUPABASE_ANON_KEY=${publishable_key}"
    fi
    
    # Derive SUPABASE_SERVICE_ROLE_KEY from secret key
    # Also support SUPABASE_SECRET_KEY -> SUPABASE_SERVICE_ROLE_KEY for backward compatibility
    if [ -n "$secret_key" ]; then
        echo "SUPABASE_SERVICE_ROLE_KEY=${secret_key}"
        # For backward compatibility
        echo "SUPABASE_SECRET_KEY=${secret_key}"
    fi
    
    # Derive NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY from STRIPE_PUBLISHABLE_KEY
    if [ -n "$stripe_publishable" ]; then
        echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${stripe_publishable}"
    fi

    # Keep every web app and the email Edge Functions on the same environment-
    # specific UCAT origin. Vercel preview builds run with NODE_ENV=production,
    # so application fallbacks alone would otherwise point previews at prod.
    if [ -z "$ucat_url" ]; then
        if [[ "$env_file" == *production* ]]; then
            ucat_url="https://ucat.altitutor.com"
        else
            ucat_url="https://ucat.development.altitutor.com"
        fi
    fi
    echo "UCAT_WEB_URL=${ucat_url}"
    echo "NEXT_PUBLIC_UCAT_URL=${ucat_url}"
    echo "NEXT_PUBLIC_UCAT_WEB_URL=${ucat_url}"
    echo "NEXT_PUBLIC_UCAT_APP_ORIGIN=${ucat_url}"
    
    # Derive TWILIO_PUBLIC_URL_* from NEXT_PUBLIC_SUPABASE_URL
    if [ -n "$project_ref" ]; then
        local supabase_url="https://${project_ref}.supabase.co"
        echo "TWILIO_PUBLIC_URL_INBOUND=${supabase_url}/functions/v1/twilio-inbound"
        echo "TWILIO_PUBLIC_URL_STATUS=${supabase_url}/functions/v1/twilio-status"
    fi
}

# Function to derive Expo client environment variables for student-app EAS builds
derive_expo_env_vars() {
    local env_file=$1
    local project_ref=""
    local publishable_key=""
    local student_url=""

    while IFS='=' read -r key value; do
        case "$key" in
            SUPABASE_PROJECT_REF|SUPABASE_PROJECT_ID)
                project_ref="$value"
                ;;
            SUPABASE_PUBLISHABLE_KEY)
                publishable_key="$value"
                ;;
            NEXT_PUBLIC_STUDENT_URL|EXPO_PUBLIC_STUDENT_WEB_URL)
                student_url="$value"
                ;;
        esac
    done < <(parse_env_file "$env_file")

    if [ -n "$project_ref" ]; then
        echo "EXPO_PUBLIC_SUPABASE_URL=https://${project_ref}.supabase.co"
    fi

    if [ -n "$publishable_key" ]; then
        echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=${publishable_key}"
    fi

    if [ -n "$student_url" ]; then
        echo "EXPO_PUBLIC_STUDENT_WEB_URL=${student_url}"
    elif [[ "$env_file" == *production* ]]; then
        echo "EXPO_PUBLIC_STUDENT_WEB_URL=https://student.altitutor.com"
    else
        echo "EXPO_PUBLIC_STUDENT_WEB_URL=https://student.development.altitutor.com"
    fi
}

# Function to derive Expo client environment variables for ucat-app EAS builds
derive_ucat_expo_env_vars() {
    local env_file=$1
    local eas_environment=$2
    local project_ref=""
    local publishable_key=""
    local ucat_url=""
    local sentry_dsn=""
    local sentry_org=""
    local sentry_project=""
    local sentry_auth_token=""

    while IFS='=' read -r key value; do
        case "$key" in
            SUPABASE_PROJECT_REF|SUPABASE_PROJECT_ID)
                project_ref="$value"
                ;;
            SUPABASE_PUBLISHABLE_KEY)
                publishable_key="$value"
                ;;
            NEXT_PUBLIC_UCAT_URL|EXPO_PUBLIC_UCAT_WEB_URL)
                ucat_url="$value"
                ;;
            UCAT_APP_SENTRY_DSN)
                sentry_dsn="$value"
                ;;
            UCAT_APP_SENTRY_PROJECT)
                sentry_project="$value"
                ;;
            SENTRY_ORG)
                sentry_org="$value"
                ;;
            SENTRY_AUTH_TOKEN)
                sentry_auth_token="$value"
                ;;
        esac
    done < <({
        parse_env_file "$SECRETS_DIR/.env.shared"
        parse_env_file "$env_file"
    })

    if [ -n "$project_ref" ]; then
        echo "EXPO_PUBLIC_SUPABASE_URL=https://${project_ref}.supabase.co"
    fi

    if [ -n "$publishable_key" ]; then
        echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=${publishable_key}"
    fi

    if [ -n "$ucat_url" ]; then
        echo "EXPO_PUBLIC_UCAT_WEB_URL=${ucat_url}"
    elif [[ "$env_file" == *production* ]]; then
        echo "EXPO_PUBLIC_UCAT_WEB_URL=https://ucat.altitutor.com"
    else
        echo "EXPO_PUBLIC_UCAT_WEB_URL=https://ucat.development.altitutor.com"
    fi

    if [ -n "$sentry_dsn" ]; then
        echo "EXPO_PUBLIC_SENTRY_DSN=${sentry_dsn}"
    fi
    echo "EXPO_PUBLIC_SENTRY_ENVIRONMENT=${eas_environment}"

    if [ -n "$sentry_org" ]; then
        echo "SENTRY_ORG=${sentry_org}"
    fi
    if [ -n "$sentry_project" ]; then
        echo "SENTRY_PROJECT=${sentry_project}"
    else
        echo "SENTRY_PROJECT=ucat-app"
    fi
    if [ -n "$sentry_auth_token" ]; then
        echo "SENTRY_AUTH_TOKEN=${sentry_auth_token}"
    fi
}

eas_project_id() {
    local app_dir=$1
    python3 - "$app_dir" <<'PY'
import json
import sys

config = json.load(open(f"{sys.argv[1]}/app.json"))
print(config.get("expo", {}).get("extra", {}).get("eas", {}).get("projectId", ""))
PY
}

# Function to get a specific env var value from a file
get_env_value() {
    local env_file=$1
    local key=$2
    while IFS='=' read -r env_key env_value; do
        if [ "$env_key" = "$key" ]; then
            echo "$env_value"
            return 0
        fi
    done < <(parse_env_file "$env_file")
    return 1
}

# Set an environment-file entry without printing its value. Existing entries
# are replaced in place; missing entries are appended.
set_env_value() {
    local env_file=$1
    local key=$2
    local value=$3
    local temp_file

    temp_file=$(mktemp) || return 1
    chmod 600 "$temp_file"
    awk -v target_key="$key" -v target_value="$value" '
        BEGIN { replaced = 0 }
        index($0, target_key "=") == 1 {
            print target_key "=" target_value
            replaced = 1
            next
        }
        { print }
        END {
            if (!replaced) print target_key "=" target_value
        }
    ' "$env_file" > "$temp_file"
    mv "$temp_file" "$env_file"
    chmod 600 "$env_file"
}

# Ensure an environment file has a high-entropy secret without ever printing
# the value. Existing non-empty values are preserved so rerunning deployment
# cannot rotate a live integration accidentally.
ensure_env_secret() {
    local env_file=$1
    local key=$2
    local existing_value=""

    existing_value=$(get_env_value "$env_file" "$key" || true)
    if [ -n "$existing_value" ]; then
        return 0
    fi

    check_command "openssl" "Install OpenSSL before generating $key" || return 1

    local generated_value
    local temp_file
    generated_value=$(openssl rand -hex 32)
    temp_file=$(mktemp) || return 1
    chmod 600 "$temp_file"

    awk -v target_key="$key" -v generated_value="$generated_value" '
        BEGIN { replaced = 0 }
        index($0, target_key "=") == 1 {
            print target_key "=" generated_value
            replaced = 1
            next
        }
        { print }
        END {
            if (!replaced) print target_key "=" generated_value
        }
    ' "$env_file" > "$temp_file"
    mv "$temp_file" "$env_file"
    chmod 600 "$env_file"
    echo -e "${GREEN}✓ Generated missing $key in $(basename "$env_file")${NC}"
}


