# Altitutor UCAT email operations

## Preview every designed email locally

Run:

```bash
pnpm ucat:email-preview
```

Then open `http://127.0.0.1:4187`. The gallery renders the real lifecycle
builder and Supabase authentication templates using illustrative student data.
It does not send email or write to the database.

For authentication flows sent by the local Supabase stack, open Inbucket at
`http://127.0.0.1:55324` after triggering a local signup, password reset, or
magic link.

## What is automated

- Welcome and first-week product education.
- Seven-day inactivity reminder with a useful next step.
- Weekly progress email only when enough activity exists to make it useful.
- Preference centre and one-click unsubscribe.
- Delivery deduplication, retry ledger, and local-time sending window.

Sending remains deliberately disabled unless all of the following are true:

1. The lifecycle Edge Function and migration have been deployed through CI/CD.
2. `UCAT_LIFECYCLE_CRON_SECRET_KEY` and `RESEND_API_KEY` are configured.
3. A dry run has been reviewed.
4. `UCAT_LIFECYCLE_EMAILS_ENABLED=true` is explicitly set.
5. The invocation uses `mode: "send"`.

## What still needs an operational layer

- Resend webhook ingestion for delivered, bounced, complained, opened, and
  clicked events.
- An internal dashboard for delivery health, campaign performance, and failed
  sends. Until then, provider delivery data is viewed in Resend and send intent
  is available in `ucat_email_delivery_ledger`.
- A controlled broadcast workflow for occasional promotions, unusual Free
  resets, product news, and referral campaigns. These should not be attached to
  the automated lifecycle scheduler.
- Suppression handling for hard bounces and complaints before lifecycle sending
  is enabled in production.
- Final domain authentication and sender reputation checks in Resend.

Product-news, promotions, and referral templates are intentionally not active
campaigns yet. They should be built only after the landing, in-app, and email
brand system is approved, and sent to students who enabled the corresponding
preference.
