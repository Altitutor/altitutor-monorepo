# Shared admin mailbox

`admin@altitutor.com` is the sole provider mailbox. Exchange owns messages,
immutable IDs, folders, shared read state, drafts and Sent Items. The portal owns
thread assignment, reviewed participant identities, explicit record context,
templates and staff signatures. See ADR 0063 and the DEV-250 research documents.

## Configuration and cutover

The server needs `EMAIL_M365_TENANT_ID`, `EMAIL_M365_CLIENT_ID` and
`EMAIL_M365_CLIENT_SECRET`. Existing `ONBOARDING_M365_*` names remain fallbacks.
The selected operational Edge senders need the same configuration in their own
environment, plus their normal Supabase service credentials. Keys never reach
browser responses. `CRON_SECRET` protects the one unified `/api/email/sync`
schedule; foreground staff refresh uses active ADMINSTAFF authentication.

The previous onboarding integration established read access only. Deployment
requires administrator-consented Microsoft Graph application `Mail.ReadWrite`
and `Mail.Send`, restricted to this mailbox through the tenant's supported
application access controls. Verify grants and mailbox scope with the tenant
administrator before cutover. No tenant grants, secrets, mailbox license,
Online Archive or real delivery have been inspected by this implementation.

The unified sync replaces `/api/onboarding/mailbox-sync` and its separate cron.
The new migration backfills cached onboarding correspondence and explicit journey
links, while the new sync maintains that compatibility projection. Enquiry ignore
and journey link decisions are portal metadata. The onboarding page opens the
unified Mail workspace; existing journey history remains readable.

Registration, booking confirmation, invoice and credit-note domain senders keep
their existing content builders and eligibility rules. Their shared mailbox
outbox durably records a delivery identity before provider work. Automatic billing
retains its existing recipient-specific keys; manual callers retain request intent
across uncertain HTTP responses. There is no fallback to a second transport after
an ambiguous Microsoft request. Security/account and UCAT campaign delivery remain
separately owned.

Before deploying the sender cutover, configure both the web server and billing
Edge environments, apply migrations through CI/CD, and verify a controlled
non-production mailbox/recipient through draft creation, shared read/folder changes,
portal and Outlook replies, attachments and Sent reconciliation. Missing Microsoft
configuration blocks affected email delivery; it does not roll back a completed
billing operation. The existing billing failure reporting remains authoritative.

## Synchronization and recovery

A durable 90-second lease shares bounded sync passes between cron and staff.
Each pass uses at most two concurrent sync requests and commits each folder page
with its cursor atomically. Recent-first bootstrap progressively imports all
primary mailbox history; completed delta tokens then track changes. Expired
cursors retain history until a fresh bootstrap reconciles current membership.
Folder errors stay visible and do not stop other folders progressing. Foreground
refresh runs every 30 seconds when visible; cached list/thread polling runs every
15 seconds. Actual freshness depends on Microsoft latency/throttling and mailbox
volume; bulk history may require multiple passes.

A send accepted with HTTP 202 is submitted, not delivered. Sent Items observation
confirms the same immutable draft identity. Network loss after external work is
unresolved and blocks repeat submission. Operational recovery looks up its
extended-property marker or recorded draft and only observes; it never repeats a
send. The Mail delivery-review dialog exposes unresolved work for staff review.
A definite 4xx rejection other than timeout leaves a preserved, retryable draft.

Portal editors coordinate draft writes and compare Microsoft's change key before
updates and sends. This detects previously completed Outlook edits. Graph v1.0
has no established atomic conditional send contract here: simultaneous Outlook
editing/sending still has a read/check/write race. Conflict UI preserves portal
text and requires choosing a version. Unsaved browser recovery is scoped to staff
and draft. Uploads currently support files smaller than 3 MB; large upload sessions
and Online Archive are not implemented.

Microsoft references: [draft send and Sent Items](https://learn.microsoft.com/en-us/graph/api/message-send?view=graph-rest-1.0), [message write permissions](https://learn.microsoft.com/en-us/graph/api/message-update?view=graph-rest-1.0), and [Outlook throttling](https://learn.microsoft.com/en-us/graph/throttling-limits#outlook-service-limits).

## Tests

The approved interfaces are mailbox sync/commands, correspondence/workflow and
admin UI workflows. Graph and operational delivery use fake HTTP providers in
unit tests; SQL contracts use only owned disposable local databases. UI contracts
exercise the actual accessory/palette registries and shared composer. They do not
prove tenant permissions or live Microsoft delivery.
