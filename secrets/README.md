# Secrets Management

Environment-specific secrets and scripts to sync them to GitHub Actions, Vercel, Supabase, and EAS (Expo).

The `.env.*` files in this directory are gitignored and must never be committed. Keep production secrets in a password manager as well, use separate credentials for development and production, and rotate them regularly.

## Directory Structure

```
secrets/
├── .gitignore
├── README.md
├── .env.shared.example
├── .env.development.example
├── .env.production.example
├── .env.shared                  # gitignored
├── .env.development             # gitignored
├── .env.production              # gitignored
└── scripts/
    ├── common.sh
    ├── configure-smtp.sh
    ├── deploy-all.sh
    ├── deploy-github.sh
    ├── deploy-vercel.sh
    ├── deploy-eas.sh
    └── deploy-supabase.sh
```

## Quick Start

### 1. Create secret files

```bash
cd secrets
cp .env.shared.example .env.shared
cp .env.development.example .env.development
cp .env.production.example .env.production
```

Fill in the values in each file.

### 2. Install prerequisites

```bash
brew install gh jq
brew install supabase/tap/supabase
npm install -g vercel eas-cli

gh auth login
vercel login
supabase login
eas login
```

### 3. Configure scripts

In `scripts/deploy-github.sh`, confirm:

```bash
GITHUB_REPO="Altitutor/altitutor-monorepo"
```

In `scripts/deploy-vercel.sh`, set `VERCEL_TEAM_ID` if you deploy under a Vercel team (leave empty for a personal account). Run `vercel teams list` to find the ID.

### 4. Deploy

```bash
cd secrets/scripts
./deploy-all.sh
```

Or individually:

```bash
./deploy-github.sh
./deploy-vercel.sh
./deploy-eas.sh
./deploy-supabase.sh
```

## Environment Files

### `.env.shared`

Secrets used across environments. Keep this small.

Examples:

- Shared third-party credentials
- `VERCEL_TOKEN` (optional; can also be set in the shell)
- `EXPO_TOKEN` (optional; can also use `eas login`)
- `SUPABASE_ACCESS_TOKEN`
- `RESEND_API_KEY` (Supabase Auth SMTP and feedback email routes)

### `.env.development` / `.env.production`

Environment-specific values such as:

- `SUPABASE_PROJECT_REF`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Stripe keys (test in development, live in production)
- `OPENROUTER_API_KEY` (tutor-web UCAT AI generation)

## Where Secrets Go

### GitHub Actions

- Repository secrets from `.env.shared`
- Environment `development` from `.env.development` (excluding `NEXT_PUBLIC_*`)
- Environment `production` from `.env.production` (excluding `NEXT_PUBLIC_*`)

Typical values include `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_ACCESS_TOKEN` when it differs by environment. Branch mapping: `develop` → development, `main` → production.

Vercel-only runtime secrets such as `OPENROUTER_API_KEY` are skipped here.

### Vercel

- Preview: `NEXT_PUBLIC_*` from `.env.development`
- Production: `NEXT_PUBLIC_*` from `.env.production`
- `OPENROUTER_API_KEY` to `altitutor-tutor-web` only
- `RESEND_API_KEY` to all web apps managed by the script

Projects currently deployed by the script:

- `altitutor-admin-web` (`apps/admin-web`)
- `altitutor-student-web` (`apps/student-web`)
- `altitutor-tutor-web` (`apps/tutor-web`)
- `altitutor-ucat-web` (`apps/ucat-web`)

### EAS (`apps/student-app`)

- Development + preview: `EXPO_PUBLIC_*` derived from `.env.development`
- Production: `EXPO_PUBLIC_*` derived from `.env.production`

Variables:

- `EXPO_PUBLIC_SUPABASE_URL` (from `SUPABASE_PROJECT_REF`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (from `SUPABASE_PUBLISHABLE_KEY`)
- `EXPO_PUBLIC_STUDENT_WEB_URL` (from `NEXT_PUBLIC_STUDENT_URL` / `EXPO_PUBLIC_STUDENT_WEB_URL`, or defaults)

Mapping:

- `.env.development` to EAS `development` and `preview`
- `.env.production` to EAS `production`

Certificates, provisioning profiles, and App Store Connect API keys are managed in the EAS dashboard, not by this script.

### Supabase Edge Functions

From `.env.shared` plus the matching environment file. Deployed keys include:

- `TWILIO_*`
- `IMESSAGE_*`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

Supabase already provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to edge functions. Do not set `SUPABASE_DB_URL` for edge functions.

### Supabase Auth SMTP

Local:

- SMTP is disabled in `config.toml`
- Emails are captured by Inbucket at http://localhost:55324

Remote development and production:

1. Put `RESEND_API_KEY` in `.env.shared`
2. Deploy secrets with `deploy-supabase.sh`
3. CI/CD runs `supabase/scripts/deploy-config.sh`, which enables SMTP and pushes config

SMTP settings (via `config.toml`):

- Host: `smtp.resend.com`
- Port: `587`
- Username: `resend`
- Password: Resend API key
- Sender: `noreply@altitutor.com` / `Altitutor`

Auth email rate limits (deployed by `deploy-config.sh`):

- Development: 200/hour (with Resend SMTP)
- Production: 100/hour

Without custom SMTP, Supabase built-in email stays around 2/hour regardless of those limits.

## Secret Filters

### GitHub (`deploy-github.sh`)

Excludes `NEXT_PUBLIC_*` (those go to Vercel).

### Vercel (`deploy-vercel.sh`)

Deploys `NEXT_PUBLIC_*` to all configured web projects, `OPENROUTER_API_KEY` to tutor-web, and `RESEND_API_KEY` to all configured web projects.

### EAS (`deploy-eas.sh`)

Deploys derived `EXPO_PUBLIC_*` values only.

### Supabase (`deploy-supabase.sh`)

Deploys `TWILIO_*`, `IMESSAGE_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `RESEND_API_KEY`.

Edit the patterns in each script if naming conventions change.

## Verification

### GitHub Actions

```bash
gh secret list --repo Altitutor/altitutor-monorepo
gh secret list --repo Altitutor/altitutor-monorepo --env development
gh secret list --repo Altitutor/altitutor-monorepo --env production
```

### Vercel

```bash
vercel env ls --project altitutor-admin-web
vercel env ls --project altitutor-student-web
vercel env ls --project altitutor-tutor-web
vercel env ls --project altitutor-ucat-web
```

### EAS

```bash
cd apps/student-app
eas env:list --environment development
eas env:list --environment preview
eas env:list --environment production
```

### Supabase

```bash
supabase secrets list --project-ref <dev-project-ref>
supabase secrets list --project-ref <prod-project-ref>
```

## Troubleshooting

### Command not found

Install the missing CLI (`gh`, `vercel`, `eas`, `supabase`, or `jq`) as listed in Quick Start.

### Not authenticated

Run `gh auth login`, `vercel login`, `eas login`, or `supabase login`.

### Vercel project not found

Confirm project names in `deploy-vercel.sh`, set `VERCEL_TEAM_ID` if needed, and run `vercel projects ls`.

### Missing Vercel or EAS token

Use CLI login, or set `VERCEL_TOKEN` / `EXPO_TOKEN` in `.env.shared`.

### Secrets not updating

Redeploy the Vercel app or re-run the GitHub Actions workflow after changing secrets.
