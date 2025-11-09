# Quick Start Guide

## Initial Setup (First Time Only)

```bash
# 1. Navigate to secrets directory
cd secrets

# 2. Create your secret files from examples
cp env.shared.example .env.shared
cp env.development.example .env.development
cp env.production.example .env.production

# 3. Fill in your actual secrets
# Use your preferred editor
code .env.shared          # or vim, nano, etc.
code .env.development
code .env.production

# 4. Install required CLIs
brew install gh               # GitHub CLI
brew install jq               # JSON processor
brew install supabase/tap/supabase  # Supabase CLI
npm install -g vercel         # Vercel CLI

# 5. Authenticate with services
gh auth login
vercel login
supabase login

# 6. Configure deployment scripts
# Edit these files and update:
# - scripts/deploy-github.sh: Set GITHUB_REPO (line 16)
# - scripts/deploy-vercel.sh: Set VERCEL_TEAM_ID if needed (line 22)
```

## Configuration Checklist

Before deploying, update these values:

### deploy-github.sh
```bash
GITHUB_REPO="your-org/altitutor-monorepo"  # Line 16
```

### deploy-vercel.sh
```bash
VERCEL_TEAM_ID=""  # Line 22 (optional, leave empty for personal)
```

### deploy-supabase.sh
```bash
# No configuration needed!
# Just make sure SUPABASE_PROJECT_REF is in your .env files
```

## Deploying Secrets

```bash
# Deploy to all platforms (recommended)
cd scripts
./deploy-all.sh

# Or deploy individually
./deploy-github.sh     # GitHub Actions only
./deploy-vercel.sh     # Vercel only
./deploy-supabase.sh   # Supabase only
```

## Required Environment Variables

### .env.shared
```bash
# Add shared secrets here (optional)
# Example: API keys used in both dev and prod
```

### .env.development
```bash
SUPABASE_PROJECT_REF=your-dev-project-ref
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key
NEXT_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key

# Add other dev secrets...
```

### .env.production
```bash
SUPABASE_PROJECT_REF=your-prod-project-ref
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key

# Add other prod secrets...
```

## Verification

```bash
# GitHub Actions
gh secret list --repo your-org/altitutor-monorepo

# Vercel
vercel env ls --project altitutor-admin-dashboard

# Supabase
supabase secrets list --project-ref <your-project-ref>
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Command not found | Install the missing CLI tool |
| Not authenticated | Run login command for that service |
| Project not found (Vercel) | Check project names in deploy-vercel.sh |
| Permission denied | Run `chmod +x scripts/*.sh` |

## Need Help?

See the full [README.md](./README.md) for detailed documentation.
