# Shared admin mailbox

Production uses `admin@altitutor.com`; preview and local development use
`admin@development.altitutor.com`. Exchange owns messages, immutable IDs, folders,
shared read state, drafts and Sent Items. The portal owns thread assignment,
reviewed participant identities, explicit record context, templates and staff
signatures. See ADR 0063 and [Microsoft setup](../../../../../docs/agents/admin-mailbox-setup.md).

## Configuration and cutover

Configure dedicated `EMAIL_M365_TENANT_ID`, `EMAIL_M365_CLIENT_ID` and
`EMAIL_M365_CLIENT_SECRET` values separately for each environment. Legacy
`ONBOARDING_M365_*` credentials are deliberately not accepted. Vercel production
selects the production mailbox; preview/development selects the development
mailbox. Explicit `EMAIL_ENVIRONMENT` must agree with Vercel metadata. Local
processes default to development, regardless of `NODE_ENV`. Edge Functions must
set `EMAIL_ENVIRONMENT` explicitly because they have no Vercel deployment identity.

Development sends require `EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS`, a comma-separated
exact list of test addresses. Every To/Cc/Bcc must be allowed; blocked messages are
rejected without silently changing recipients. Configure the list only with
internal Altitutor staff addresses. Exchange also blocks external recipients for
the development sender, including Outlook sends; the application list remains
narrower than the tenant-wide internal-recipient boundary.

Each database binds once to one mailbox through `email_assert_mailbox`. Existing
provider state binds to the previous production mailbox; it cannot silently become
a development cache. A mismatch stops access and preserves mail. Use a matching
separate database rather than deleting or reinterpreting cached provider IDs.
The new migration ships through CI/CD.

Both applications use Exchange Application RBAC `Application Mail.ReadWrite` and
`Application Mail.Send`, scoped to the one matching mailbox. Do not add tenant-wide
Entra Graph mail grants: Entra grants are additive and would defeat this boundary.
Staff use their existing portal ADMINSTAFF sessions; they do not individually
connect Microsoft accounts. Outlook access is a separate Exchange mailbox delegation.

Keys never reach browser responses. `CRON_SECRET` protects `/api/email/sync`;
foreground refresh uses active ADMINSTAFF authentication. Vercel preview does not
execute cron, so controlled preview QA uses the Mail refresh action. Real Graph
credentials and delivery are a separate human verification step after deployment.

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
