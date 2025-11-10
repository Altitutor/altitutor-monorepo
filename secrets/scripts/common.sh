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
    
    # Derive TWILIO_PUBLIC_URL_* from NEXT_PUBLIC_SUPABASE_URL
    if [ -n "$project_ref" ]; then
        local supabase_url="https://${project_ref}.supabase.co"
        echo "TWILIO_PUBLIC_URL_INBOUND=${supabase_url}/functions/v1/twilio-inbound"
        echo "TWILIO_PUBLIC_URL_STATUS=${supabase_url}/functions/v1/twilio-status"
    fi
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




