# Altitutor UCAT email operations

This document is the operating map for customer email. It separates account
and billing messages that must be sent from optional lifecycle communication.

## Preview every designed email locally

Run:

```bash
pnpm ucat:email-preview
```

Open `http://127.0.0.1:4187`. The gallery renders the real lifecycle,
transactional and Supabase authentication templates with illustrative data.
Every card has a light preview and a forced dark-mode preview. No email is sent
and no database is written.

For authentication emails sent by the local Supabase stack, open Inbucket at
`http://127.0.0.1:55324` after triggering a local signup, password reset or
magic link.

## Message ownership and triggers

| Message | Trigger / source of truth | Delivery owner | Preference |
| --- | --- | --- | --- |
| Confirm account, password reset, magic link, invite, email change, reauthentication | Supabase Auth event | Supabase Auth SMTP | Required |
| Supported-access application received | Insert into `ucat_public_interest_submissions` | Transactional outbox | Required |
| Online-tutoring waitlist received | Insert into `ucat_public_interest_submissions` | Transactional outbox | Required |
| Referral gift received | Referral gift row created | Transactional outbox | Required |
| Referrer earned free access / credit / free bill | Reward row created | Transactional outbox | Required |
| Unlimited activated or trial started | Verified `checkout.session.completed` | Stripe webhook → transactional outbox | Required |
| Trial ending soon | Verified `customer.subscription.trial_will_end` | Stripe webhook direct send | Required |
| Cancellation scheduled or reversed | Verified `customer.subscription.updated` state transition | Stripe webhook → transactional outbox | Required |
| Moved to Free after cancellation | Verified `customer.subscription.deleted` | Stripe webhook → transactional outbox | Required |
| Billing recovery and access ended | Stripe invoice/subscription failure state | Stripe webhook direct send | Required |
| Payment receipt / invoice / failed-card notification | Stripe invoice state | Stripe-hosted customer emails | Required |
| Welcome and first-week education | Lifecycle eligibility and local send window | Lifecycle scheduler | `lessons_and_tips` |
| Seven-day return | Seven days without product activity | Lifecycle scheduler | `lessons_and_tips` |
| Weekly progress and recommendation | Enough recent evidence for a useful report | Lifecycle scheduler | `weekly_progress_and_guidance` |
| Product news, unusual Free resets, promotions, referral campaigns | Deliberate broadcast approved by the team | Future broadcast workflow | Matching explicit preference |

Product state changes are keyed to verified Stripe webhooks, not browser
redirects or subscription button clicks. Database triggers queue referral and
public-form acknowledgements in the same transaction as the source record.

## Sending architecture

`ucat_transactional_email_outbox` is a service-only, retryable queue. A
Postgres cron invokes `ucat-transactional-email-dispatch` every minute, where
available. The dispatcher claims rows with `SKIP LOCKED`, checks permanent
suppression, sends through Resend with a deterministic idempotency key, and
retries temporary failures up to five times.

The lifecycle scheduler remains disabled unless all of these are true:

1. Migrations and Edge Functions have shipped through CI/CD.
2. A dry run has been reviewed.
3. `UCAT_LIFECYCLE_EMAILS_ENABLED=true`.
4. The request explicitly uses `mode: "send"`.

## Required production configuration

Configure secrets through the normal deployment workflow:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `UCAT_EMAIL_DISPATCH_SECRET_KEY`
- `UCAT_LIFECYCLE_CRON_SECRET_KEY`
- `POSTHOG_PROJECT_TOKEN`
- `POSTHOG_HOST` (optional; defaults to the US ingest host)
- `UCAT_WEB_URL`

The database Vault value `ucat_email_dispatch_secret` must exactly match
`UCAT_EMAIL_DISPATCH_SECRET_KEY`. `project_url` must also be present for the
database cron. Do not apply these values or migrations to a remote database
manually; ship them through CI/CD.

In Resend:

1. Authenticate the Altitutor sending domain (SPF and DKIM) and enable DMARC
   reporting before launch.
2. Add the webhook endpoint
   `/functions/v1/resend-webhooks`.
3. Subscribe to delivered, delayed, failed, bounced, complained, suppressed,
   clicked and opened events.
4. Copy the webhook signing secret into `RESEND_WEBHOOK_SECRET`.
5. Keep `matt@altitutor.com` and `admin@altitutor.com` monitored. They are the
   only reply addresses used by the UCAT templates.

In Stripe Customer emails:

1. Keep successful-payment receipts enabled.
2. Keep failed-payment emails enabled alongside Smart Retries.
3. Do not enable a duplicate Stripe trial-ending email; Altitutor sends the
   more useful trial estimate itself.
4. Confirm the public business name, support address and statement descriptor.

Altitutor should not generate a second invoice email. Stripe owns tax/payment
receipts and hosted invoices; Altitutor owns product access, reward and study
guidance messages.

## Delivery health and effectiveness

The signed Resend webhook writes idempotent events to
`ucat_email_delivery_events`. Permanent bounces, complaints and provider
suppression populate `ucat_email_suppressions`; lifecycle eligibility and the
transactional dispatcher exclude those addresses.

Resend is the operational delivery view. Use it for accepted, delivered,
bounced and complained counts and individual provider failures.

PostHog receives server-side `email delivered` and `email clicked` events with
the same auth user ID used by UCAT web analytics. Campaign CTAs also carry
`utm_source=altitutor`, `utm_medium=email`, a stable campaign name and CTA
content. Evaluate campaigns as a funnel:

1. eligible
2. sent / accepted
3. delivered
4. clicked
5. returned to the intended product page
6. completed the intended action

Open rate is stored for diagnosis but should not be treated as a primary
success metric because mail privacy features make opens unreliable. Prefer
click-through, resumed practice, benchmark completion, study-plan setup,
referral acceptance and paid conversion.

## Launch checks

- Render every light and dark preview and inspect mobile width.
- Send seed-list tests to Apple Mail, Gmail and Outlook.
- Verify password reset works from a different browser/device.
- Trigger one local example of each outbox-producing database event.
- Confirm duplicate Stripe and Resend webhooks do not duplicate sends/events.
- Confirm a bounced address becomes suppressed and is no longer eligible.
- Confirm PostHog events use the student auth user ID, campaign and intended
  landing page.
- Review Resend delivery health daily during launch week.
