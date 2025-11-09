# Secrets Management

Centralized secrets management for the Altitutor monorepo. This directory contains environment-specific secrets and deployment scripts to sync them across GitHub Actions, Vercel, and Supabase.

## 🔐 Security Notice

**⚠️ IMPORTANT:** The `.env.*` files in this directory are **gitignored** and contain sensitive credentials. Never commit them to version control.

- Only store production secrets locally or in a secure password manager
- Use separate credentials for development and production
- Rotate secrets regularly
- Limit access to production secrets to senior team members only

## 📁 Directory Structure

```
secrets/
├── .gitignore                   # Protects .env files from being committed
├── README.md                    # This file
├── env.shared.example           # Template for shared secrets
├── env.development.example      # Template for development secrets
├── env.production.example       # Template for production secrets
├── .env.shared                  # Actual shared secrets (gitignored)
├── .env.development             # Actual development secrets (gitignored)
├── .env.production              # Actual production secrets (gitignored)
└── scripts/
    ├── common.sh                # Shared utility functions
    ├── deploy-all.sh            # Master deployment script (runs all below)
    ├── deploy-github.sh         # Deploy to GitHub Actions
    ├── deploy-vercel.sh         # Deploy to Vercel projects
    └── deploy-supabase.sh       # Deploy to Supabase edge functions
```

## 🚀 Quick Start

### 1. Initial Setup

```bash
# Navigate to secrets directory
cd secrets

# Copy example files to create your secret files
cp env.shared.example .env.shared
cp env.development.example .env.development
cp env.production.example .env.production

# Edit files and fill in your actual secrets
# Use your preferred editor (vim, nano, vscode, etc.)
vim .env.shared
vim .env.development
vim .env.production
```

### 2. Install Prerequisites

```bash
# GitHub CLI (for GitHub Actions secrets)
brew install gh
gh auth login

# Vercel CLI (for Vercel environment variables)
npm install -g vercel
vercel login

# Supabase CLI (for Edge Function secrets)
brew install supabase/tap/supabase
supabase login

# jq (JSON processor, required by Vercel script)
brew install jq
```

### 3. Configure Scripts

Before running deployment scripts, update the configuration values:

**`scripts/deploy-github.sh`:**
```bash
GITHUB_REPO="your-org/altitutor-monorepo"  # Line 16
```

**`scripts/deploy-vercel.sh`:**
```bash
VERCEL_TEAM_ID=""  # Line 22 (optional, leave empty for personal account)
```

Run `vercel teams list` to get your team ID if needed.

### 4. Deploy Secrets

```bash
# Deploy to all platforms at once (recommended)
cd secrets/scripts
./deploy-all.sh

# Or deploy individually:
./deploy-github.sh     # GitHub Actions only
./deploy-vercel.sh     # Vercel only
./deploy-supabase.sh   # Supabase only
```

## 📋 Environment Files Guide

### `.env.shared`
Secrets used across **all environments** (dev and prod). Use sparingly.

**Examples:**
- Third-party API keys that are the same in dev/prod
- Service credentials shared across environments
- Non-environment-specific configuration

### `.env.development`
Secrets for **development/preview environments**.

**Examples:**
- `SUPABASE_PROJECT_REF` (dev project)
- `SUPABASE_SERVICE_ROLE_KEY` (dev)
- `NEXT_PUBLIC_SUPABASE_URL` (dev)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (dev)
- `STRIPE_SECRET_KEY` (test mode: `sk_test_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test mode: `pk_test_...`)

### `.env.production`
Secrets for **production environment**.

**⚠️ Handle with extreme care!**

**Examples:**
- `SUPABASE_PROJECT_REF` (prod project)
- `SUPABASE_SERVICE_ROLE_KEY` (prod)
- `NEXT_PUBLIC_SUPABASE_URL` (prod)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (prod)
- `STRIPE_SECRET_KEY` (live mode: `sk_live_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (live mode: `pk_live_...`)

## 🎯 Where Secrets Go

### GitHub Actions
- **Repository secrets**: Shared secrets from `.env.shared`
- **Environment: development**: Secrets from `.env.development` (excluding `NEXT_PUBLIC_*`)
- **Environment: production**: Secrets from `.env.production` (excluding `NEXT_PUBLIC_*`)

**Why:** GitHub Actions uses these for CI/CD workflows, database migrations, and automated tasks.

### Vercel
- **Preview environment**: Client-side vars from `.env.development` (`NEXT_PUBLIC_*`)
- **Production environment**: Client-side vars from `.env.production` (`NEXT_PUBLIC_*`)

**Apps deployed:**
- `altitutor-admin-dashboard` (apps/admin-web)
- `altitutor-student-dashboard` (apps/student-web)
- `altitutor-tutor-dashboard` (apps/tutor-web)

**Why:** Vercel needs client-side environment variables at build time. Only `NEXT_PUBLIC_*` variables are exposed to the browser.

### Supabase Edge Functions
- **Development**: Secrets needed by edge functions from `.env.shared` and `.env.development`
- **Production**: Secrets needed by edge functions from `.env.shared` and `.env.production`

**Auto-provided (no need to set):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

**Why:** Edge functions need access to third-party APIs (Stripe, Twilio, etc.) to process payments, send SMS, etc.

## 🔧 Customizing Secret Filters

By default, the scripts use patterns to determine which secrets go where:

### GitHub (`deploy-github.sh`)
```bash
# Excludes NEXT_PUBLIC_* (Vercel-only)
if [[ ! "$key" =~ ^NEXT_PUBLIC_ ]]; then
    deploy_github_secret "$key" "$value" "development"
fi
```

### Vercel (`deploy-vercel.sh`)
```bash
# Only includes NEXT_PUBLIC_* and Supabase public keys
if [[ "$key" =~ ^NEXT_PUBLIC_ ]] || [[ "$key" =~ ^(SUPABASE_URL|SUPABASE_ANON_KEY)$ ]]; then
    deploy_vercel_secret "$key" "$value" "$project" "preview"
fi
```

### Supabase (`deploy-supabase.sh`)
```bash
# Only includes API keys/secrets needed by edge functions
# Customize this regex based on your needs:
if [[ "$key" =~ ^(TWILIO_|STRIPE_SECRET_|RESEND_|SENDGRID_).*$ ]]; then
    deploy_supabase_secret "$key" "$value" "$project_ref" "production"
fi
```

**To customize:** Edit the regex patterns in each deployment script to match your naming conventions.

## 🔍 Verification

After deployment, verify secrets are set:

### GitHub Actions
```bash
gh secret list --repo your-org/altitutor-monorepo
gh secret list --repo your-org/altitutor-monorepo --env development
gh secret list --repo your-org/altitutor-monorepo --env production
```

### Vercel
```bash
# List environment variables for a project
vercel env ls --project altitutor-admin-dashboard
vercel env ls --project altitutor-student-dashboard
vercel env ls --project altitutor-tutor-dashboard
```

### Supabase
```bash
supabase secrets list --project-ref <your-dev-project-ref>
supabase secrets list --project-ref <your-prod-project-ref>
```

## 🐛 Troubleshooting

### "Command not found" errors
Install the missing CLI tool:
- `gh`: `brew install gh`
- `vercel`: `npm install -g vercel`
- `supabase`: `brew install supabase/tap/supabase`
- `jq`: `brew install jq`

### "Not authenticated" errors
Log in to each service:
- `gh auth login`
- `vercel login`
- `supabase login`

### "Project not found" (Vercel)
- Ensure project names in `deploy-vercel.sh` match your actual Vercel projects
- Check if you need to set `VERCEL_TEAM_ID` for team accounts
- Run `vercel projects ls` to see available projects

### "No auth token" (Vercel)
- Run `vercel login` and authenticate
- Alternatively, set `VERCEL_TOKEN` environment variable with your token

### Secrets not updating
- Vercel and GitHub cache secrets. Redeploy or restart to see changes.
- For Vercel: Trigger a new deployment
- For GitHub Actions: Re-run the workflow

## 🎓 Best Practices

1. **Development First:** Always test secret deployment in development before production
2. **Backup:** Keep production secrets in a secure password manager (1Password, LastPass, etc.)
3. **Rotation:** Rotate production secrets periodically (every 90 days)
4. **Access Control:** Limit who has access to `.env.production`
5. **Never Commit:** Double-check `.gitignore` includes all `.env.*` files
6. **Document:** Keep notes of what each secret is used for in the example files
7. **Review:** Before deploying, review what secrets will be deployed with `git diff`

## 🚀 Future: Migration to Production Pattern (Doppler/1Password)

This is a **Quick Path** implementation. For production-grade secret management:

### Option 1: Doppler (Recommended)
- Encrypted secret storage with audit logs
- RBAC (role-based access control)
- Native GitHub Actions, Vercel, and Supabase integrations
- Secret versioning and rollback
- CLI for local development

### Option 2: 1Password CLI
- Uses your existing 1Password account
- Secret references in scripts
- Encrypted vaults
- Good for small teams already using 1Password

**When ready to upgrade:** Your existing scripts can stay mostly the same - just change the source from `.env.*` files to Doppler/1Password CLI commands.

## 📚 Additional Resources

- [GitHub Actions Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Doppler Documentation](https://docs.doppler.com/)
- [1Password CLI](https://developer.1password.com/docs/cli/)
