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
    ├── generate-apple-client-secret.mjs
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

For a narrowly scoped UCAT cron-secret deployment, without touching any other
Vercel variables:

```bash
./deploy-vercel.sh --only CRON_SECRET
```

### Print bridge (Mac Mini)

Office print uses the same pull-connector pattern as iMessage. Generate/sync the Mac `.env` from this folder:

```bash
./secrets/scripts/setup-print-bridge-env.sh --env production
./secrets/scripts/deploy-supabase.sh
```

That writes `CONNECTOR_SECRET` into `.env.production` if missing (reusing `IMESSAGE_WEBHOOK_SECRET` when present) and creates `../print-bridge/.env`.

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
- `SENTRY_ORG` and `SENTRY_AUTH_TOKEN` (shared Sentry build credentials)
- `{APP}_SENTRY_DSN` and `{APP}_SENTRY_PROJECT` for each independently
  deployed web app, such as `UCAT_WEB_SENTRY_DSN`
- `SUPABASE_SENTRY_DSN` for the dedicated Deno project used by Supabase Edge
  Functions (the same project DSN can be used in both environment files)
- UCAT social provider credentials (`SUPABASE_AUTH_EXTERNAL_GOOGLE_*` and
  `SUPABASE_AUTH_EXTERNAL_APPLE_*`) plus `AUTH_GOOGLE_ENABLED` and
  `AUTH_APPLE_ENABLED`

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
- `NEXT_PUBLIC_POSTHOG_*` only to the public marketing, student, and UCAT apps
- `OPENROUTER_API_KEY` to `altitutor-tutor-web` only
- `RESEND_API_KEY` to all web apps managed by the script
- Per-app Sentry values are mapped to framework-standard target names:
  `{APP}_SENTRY_DSN` → `NEXT_PUBLIC_SENTRY_DSN` and
  `{APP}_SENTRY_PROJECT` → `SENTRY_PROJECT`
- Sentry events are tagged automatically as `preview` or `production` through
  `NEXT_PUBLIC_SENTRY_ENVIRONMENT` and `SENTRY_ENVIRONMENT`; local Next.js
  development falls back to `development`
- Shared `SENTRY_ORG` and `SENTRY_AUTH_TOKEN` values are sent only to apps
  whose per-app Sentry configuration is non-empty
- `AUTH_GOOGLE_ENABLED` and `AUTH_APPLE_ENABLED` are sent only to
  `altitutor-ucat-web`; provider credentials stay in GitHub Actions and are
  applied to hosted Supabase Auth by CI
- `CRON_SECRET` is generated once when missing and sent only to
  `altitutor-ucat-web` for authenticated Preview and Production cron routes

Projects currently deployed by the script:

- `altitutor-admin-web` (`apps/admin-web`)
- `altitutor-marketing-web` (`apps/marketing-web`)
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
- `CONNECTOR_SECRET` (shared Mac pull-connector for iMessage + office print; Edge Functions also accept `IMESSAGE_WEBHOOK_SECRET` as fallback)
- `PRINT_CONNECTOR_SECRET` (optional override; print-connector falls back to `CONNECTOR_SECRET`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `SUPABASE_SENTRY_DSN` → `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`, derived automatically as `development` or `production`

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

### Supabase social sign-in

- OAuth client IDs and secrets live in the matching development or production
  GitHub Environment.
- `AUTH_GOOGLE_ENABLED` and `AUTH_APPLE_ENABLED` are GitHub Environment
  variables used by `supabase/scripts/deploy-config.sh`.
- The same flags are deployed to the matching UCAT Vercel target so buttons
  become visible only when the hosted provider is enabled.
- Provider credentials are never deployed to Vercel or Supabase Edge Function
  secrets.
- Generate and rotate the Apple client secret without printing it to the
  terminal:

  ```bash
  node secrets/scripts/generate-apple-client-secret.mjs \
    --private-key /secure/path/AuthKey_KEYID.p8 \
    --key-id KEYID \
    --team-id TEAMID \
    --client-id com.altitutor.ucat.web \
    --env development --env production
  ```

  The command updates the gitignored environment files and reports only the
  expiry date. Keep the `.p8` file in secure backup storage; Apple does not
  allow it to be downloaded again.

## Secret Filters

### GitHub (`deploy-github.sh`)

Excludes `NEXT_PUBLIC_*` (those go to Vercel).

### Vercel (`deploy-vercel.sh`)

Deploys `NEXT_PUBLIC_POSTHOG_*` only to the public marketing, student, and UCAT projects. Other `NEXT_PUBLIC_*` variables go to the existing application projects. `OPENROUTER_API_KEY` goes to tutor-web, and `RESEND_API_KEY` goes to all application web projects.

### EAS (`deploy-eas.sh`)

Deploys derived `EXPO_PUBLIC_*` values only.

### Supabase (`deploy-supabase.sh`)

Deploys `TWILIO_*`, `IMESSAGE_*`, `CONNECTOR_SECRET`, `PRINT_CONNECTOR_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `RESEND_API_KEY`.

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
vercel env ls --project altitutor-marketing-web
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
