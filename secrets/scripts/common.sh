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

