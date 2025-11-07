#!/bin/bash

# ============================================================
# Master Secret Deployment Script
# Orchestrates deployment to GitHub, Vercel, and Supabase
# ============================================================

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source common utilities
source "$SCRIPT_DIR/common.sh"

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}Master Secret Deployment Script${NC}"
echo -e "${BLUE}Deploying to: GitHub Actions, Vercel, and Supabase${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo ""

# Track overall success
OVERALL_SUCCESS=0
OVERALL_FAILURES=0

# Store individual deployment counts
GITHUB_SUCCESS=0
GITHUB_FAILURES=0
VERCEL_SUCCESS=0
VERCEL_FAILURES=0
SUPABASE_SUCCESS=0
SUPABASE_FAILURES=0

# ============================================================
# 1. Deploy to GitHub Actions
# ============================================================

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Step 1/3: GitHub Actions Deployment                 ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

if bash "$SCRIPT_DIR/deploy-github.sh"; then
    echo -e "${GREEN}✓ GitHub deployment completed successfully${NC}"
    GITHUB_SUCCESS=$SUCCESS_COUNT
else
    echo -e "${RED}✗ GitHub deployment had failures${NC}"
    GITHUB_FAILURES=$FAILURE_COUNT
    OVERALL_FAILURES=$((OVERALL_FAILURES + FAILURE_COUNT))
fi

OVERALL_SUCCESS=$((OVERALL_SUCCESS + SUCCESS_COUNT))

# Reset counters for next deployment
SUCCESS_COUNT=0
FAILURE_COUNT=0
TOTAL_COUNT=0

echo ""
echo ""

# ============================================================
# 2. Deploy to Vercel
# ============================================================

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Step 2/3: Vercel Deployment                         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

if bash "$SCRIPT_DIR/deploy-vercel.sh"; then
    echo -e "${GREEN}✓ Vercel deployment completed successfully${NC}"
    VERCEL_SUCCESS=$SUCCESS_COUNT
else
    echo -e "${RED}✗ Vercel deployment had failures${NC}"
    VERCEL_FAILURES=$FAILURE_COUNT
    OVERALL_FAILURES=$((OVERALL_FAILURES + FAILURE_COUNT))
fi

OVERALL_SUCCESS=$((OVERALL_SUCCESS + SUCCESS_COUNT))

# Reset counters for next deployment
SUCCESS_COUNT=0
FAILURE_COUNT=0
TOTAL_COUNT=0

echo ""
echo ""

# ============================================================
# 3. Deploy to Supabase Edge Functions
# ============================================================

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Step 3/3: Supabase Edge Functions Deployment        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

if bash "$SCRIPT_DIR/deploy-supabase.sh"; then
    echo -e "${GREEN}✓ Supabase deployment completed successfully${NC}"
    SUPABASE_SUCCESS=$SUCCESS_COUNT
else
    echo -e "${RED}✗ Supabase deployment had failures${NC}"
    SUPABASE_FAILURES=$FAILURE_COUNT
    OVERALL_FAILURES=$((OVERALL_FAILURES + FAILURE_COUNT))
fi

OVERALL_SUCCESS=$((OVERALL_SUCCESS + SUCCESS_COUNT))

echo ""
echo ""

# ============================================================
# Final Summary
# ============================================================

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}Final Deployment Summary${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo ""

echo -e "${YELLOW}Breakdown by Platform:${NC}"
echo -e "  GitHub Actions:      ${GREEN}${GITHUB_SUCCESS:-0} successful${NC} / ${RED}${GITHUB_FAILURES:-0} failed${NC}"
echo -e "  Vercel:              ${GREEN}${VERCEL_SUCCESS:-0} successful${NC} / ${RED}${VERCEL_FAILURES:-0} failed${NC}"
echo -e "  Supabase:            ${GREEN}${SUPABASE_SUCCESS:-0} successful${NC} / ${RED}${SUPABASE_FAILURES:-0} failed${NC}"
echo ""

echo -e "${YELLOW}Overall Total:${NC}"
echo -e "  ${GREEN}Successful: $OVERALL_SUCCESS${NC}"
echo -e "  ${RED}Failed: $OVERALL_FAILURES${NC}"
echo ""

if [ $OVERALL_FAILURES -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ All secrets deployed successfully across all      ║${NC}"
    echo -e "${GREEN}║    platforms!                                         ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ Some deployments failed. Please check the logs    ║${NC}"
    echo -e "${RED}║    above for details.                                 ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════╝${NC}"
    exit 1
fi

