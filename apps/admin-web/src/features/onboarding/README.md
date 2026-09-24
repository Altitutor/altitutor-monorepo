# Trial students

Production entry: `/trial-students` under Communication.

The queue reads onboarding journey decisions plus evidence from booking, actual attendance, forms, registration, payment methods, class enrolments, invoices and successful message delivery. It never completes a task because a note was entered. Existing operational dialogs perform the underlying actions.

The Messages composer and thread renderer are shared with the unified feed. Source filters affect visibility, not reply destination. Every activity and message page remains accessible through “Load older messages”. Email bodies are rendered as text.

## Deployment

Ship `supabase/migrations/20260913081536_in_person_onboarding.sql` through the usual database CI/CD before the web release. No remote migration was applied during implementation. Existing trial students import with an unknown enquiry date and are excluded from clean enquiry cohorts. Bookings made through Sessions also create or attach journeys.

Microsoft365 synchronization requires these server-only environment variables:

- `ONBOARDING_M365_TENANT_ID`
- `ONBOARDING_M365_CLIENT_ID`
- `ONBOARDING_M365_CLIENT_SECRET`
- `CRON_SECRET` for the Vercel cron endpoint

The tenant app needs application `Mail.Read`, administrator consent, and access scoped to `admin@altitutor.com`. No mailbox connection is implied by shipping code. The UI reports missing configuration. Sync uses per-folder delta cursors, immutable message IDs, bounded pages per run, and idempotent upserts. “Review mailbox” also allows an administrator to initiate a sync. Email drafts open in the staff member's mail application; send them from the admin mailbox so sent-mail synchronization can observe the result.

References: [Microsoft delta message synchronization](https://learn.microsoft.com/en-us/graph/delta-query-messages), [application authentication](https://learn.microsoft.com/en-us/graph/auth-v2-service).

## Prototype source

ALTI-615 records the approved decisions and verification. The throwaway UI is preserved at `codex/prototype-trial-students`, commit `8d3ccd6c32a8bf61fac1729fefe0dd60a38ec67a`, including the initial alternatives. Its data is fictional and its actions are simulated.
