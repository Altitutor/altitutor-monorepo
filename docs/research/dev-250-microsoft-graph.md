# DEV-250: Microsoft Graph mailbox integration

Researched 2026-10-28 against Microsoft primary documentation. Research only: no tenant inspection, mailbox access, account changes, implementation or send tests were performed. Recommendations below are architectural judgments; tenant compatibility remains unverified.

## Recommendation

If `admin@altitutor.com` is an Exchange Online primary/shared mailbox, use a server-side, single-tenant Graph connector with app-only authentication and mailbox-scoped Exchange Application RBAC. Keep Outlook as the mailbox system of record. Start with a focused staff inbox and reply workflow; add local operational metadata only where Altitutor needs concepts such as assignment or resolution. Avoid making every staff member connect a Microsoft identity just to operate this one mailbox.

Prefer a small synchronized message index plus on-demand bodies/attachments if fast lists, contact history and shared workflow matter. A live Graph-only adapter is simpler if the actual requirement is occasional reading/replying and manual refresh is acceptable. Full mailbox mirroring is a larger retention, privacy and recovery commitment; choose that only for a demonstrated requirement.

The prerequisite is the mailbox service, not the Outlook client: Graph mail accesses Exchange Online cloud primary/shared mailboxes; it does not access in-place archive mailboxes. Existing historical mail moved to Online Archive therefore needs an explicit scope decision. The ordinary one-click Archive folder is different and remains part of the primary mailbox. [Mail API overview](https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview), [mailFolder resource](https://learn.microsoft.com/en-us/graph/api/resources/mailfolder?view=graph-rest-1.0).

## Authentication and mailbox type

| Choice | What Microsoft supports | Consequence for this ticket |
| --- | --- | --- |
| App-only | Client credentials authenticate the application, independently of an active staff session; credentials can be a certificate, client secret or federated identity. | Recommended for background synchronization of one company mailbox; credentials stay server-side. |
| Delegated own mailbox | Graph acts for the signed-in Microsoft user. | Appropriate if each employee must operate their own mailbox. It adds Microsoft sign-in/token lifecycle to the existing portal identity. |
| Delegated shared mailbox | `Mail.Read.Shared` / `Mail.ReadWrite.Shared` use a user's existing mailbox access. Sending additionally needs `Mail.Send.Shared` and Exchange Send As/Send on Behalf permissions. | Suitable for an interactive delegated client, but shared/delegated folder permissions cannot create message-change subscriptions. |

Sources: [app-only authentication](https://learn.microsoft.com/en-us/graph/auth-v2-service), [shared-folder access](https://learn.microsoft.com/en-us/graph/outlook-share-messages-folders), [sending from another user](https://learn.microsoft.com/en-us/graph/outlook-send-mail-from-other-user).

A shared mailbox fits a multi-person company address; conversion is not required merely to use Graph, since normal Exchange Online mailboxes are also supported. Shared-mailbox direct sign-in should stay blocked. A shared mailbox can hold up to 50 GB without its own license, with additional licensing for larger storage/other features; human delegates need licensed Exchange Online mailboxes. Microsoft 365 subscriptions without Exchange email are insufficient. Verify actual licensing and tenant configuration rather than assuming an existing Outlook address establishes eligibility. [Shared mailbox requirements](https://learn.microsoft.com/en-us/microsoft-365/admin/email/about-shared-mailboxes?view=o365-worldwide).

## Permission scope is a security acceptance criterion

Exchange Application RBAC replaces Application Access Policies and can scope application roles to selected mailboxes. For draft creation, message updates and sending, the relevant roles are `Application Mail.ReadWrite` and `Application Mail.Send`; the former does not include sending. A read-only first stage can use `Application Mail.Read`.

**Critical pitfall:** Exchange RBAC grants and Entra application grants are additive. A broad Entra `Mail.ReadWrite` or `Mail.Send` consent is not narrowed by adding a scoped Exchange RBAC role. Configure the intended scoped authorization without leaving an independent unscoped grant. `Test-ServicePrincipalAuthorization` checks RBAC but excludes separate Entra permissions; supplement it with actual allowed-mailbox and forbidden-mailbox API tests. Permission changes can take 30 minutes–2 hours to propagate even when the test cmdlet already reflects them. An Exchange administrator must establish the scope and role assignments. [Exchange Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

Design implication: hard-code/allowlist the configured mailbox identity server-side, and separately enforce Altitutor staff authorization and audit who requested a send. Graph application identity alone does not identify which portal staff member acted. Prove scoped read, draft, send and subscription behavior using test fixtures before accepting the integration.

## Message identity, folders and conversations

- Use `Prefer: IdType="ImmutableId"` consistently on message requests, delta and subscription creation. Default message IDs change when moved; immutable IDs remain stable within the same mailbox. They remain case-sensitive and can change after export/reimport or transfer into an archive mailbox. Existing nonimmutable subscriptions need recreation to switch formats. [Immutable identifiers](https://learn.microsoft.com/en-us/graph/outlook-immutable-id).
- Store mailbox + immutable message ID as the provider identity; also retain `internetMessageId`, `conversationId`, `parentFolderId`, timestamps and `changeKey`. The message resource provides conversation grouping and version fields. **Inference:** group within this mailbox by `conversationId`, but keep Altitutor's contact/business association separately; neither subject equality nor conversation grouping proves which student/family owns a message. Inline-only attachments do not set `hasAttachments=true`. [Message resource](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0).
- Root folder listing is not recursive; hidden folders are excluded by default. Discover nested physical folders explicitly and define treatment of Junk/Deleted Items/search folders. [List mailFolders](https://learn.microsoft.com/en-us/graph/api/user-list-mailfolders?view=graph-rest-1.0). Use well-known folder names (`inbox`, `sentitems`, `drafts`) rather than localized display names. [mailFolder resource](https://learn.microsoft.com/en-us/graph/api/resources/mailfolder?view=graph-rest-1.0).

## Synchronization and recovery

Message delta tracking is per folder, not a single mailbox-wide cursor. Follow complete opaque `@odata.nextLink` URLs until the round ends, then persist the returned `@odata.deltaLink`. A move/deletion can appear as `@removed` in the source folder. Delta supports selected fields but has limited date filtering/order and no `$search`. [Message delta API](https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0).

Process updates idempotently: replays are possible. Outlook delta-token lifetime has no fixed guaranteed TTL; `410 Gone` or errors such as `syncStateNotFound` require reinitialization/full synchronization. A durable cursor therefore needs a tested rebuild path, not just retry logic. Notifications can trigger delta reconciliation rather than attempting to apply every notification directly. [Delta query behavior](https://learn.microsoft.com/en-us/graph/delta-query-overview).

Webhooks need a public HTTPS endpoint with validation handling. Validate `clientState`, persist/queue work and acknowledge promptly; Microsoft's current guidance uses a 3-second acknowledgement target and retries failures for up to 4 hours. Slow endpoints can have notifications dropped. [Webhook delivery](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks).

Outlook subscriptions expire within about seven days; subscriptions containing resource data expire within about one day. Prefer basic notifications plus a Graph fetch/delta operation initially, avoiding rich-notification encryption complexity. Renew well before expiry with a monitored scheduled job. [Subscription resource/lifetimes](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0). Handle `reauthorizationRequired`, `subscriptionRemoved` and `missed`; recreate/reauthorize as appropriate and resynchronize across delivery gaps. Add periodic reconciliation so correctness does not depend solely on uninterrupted webhook delivery. [Lifecycle events and recovery](https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events).

For a single low-volume mailbox, scheduled per-folder delta with manual refresh is a reasonable first implementation **if** the accepted freshness requirement permits it. Webhooks improve latency but create a renewal/recovery operating responsibility; this is a product/operations tradeoff, not a prerequisite for listing mail.

## Drafts, replies, attachments and send status

Use Graph `createReply` / `createReplyAll` for actual replies, then update the returned draft and send it. Respect the original message's `replyTo`; a new message with a `Re:` subject is not an equivalent reply operation. `createReply` requires `Mail.ReadWrite`. [Create reply draft](https://learn.microsoft.com/en-us/graph/api/message-createreply?view=graph-rest-1.0).

Draft-first is recommended: it provides a provider ID before submission, attachment editing and a recoverable user-visible object. Sending a draft uses `Mail.Send` and saves a Sent Items copy. [Send draft](https://learn.microsoft.com/en-us/graph/api/message-send?view=graph-rest-1.0). With immutable IDs, the original draft ID can retrieve the eventual Sent Items copy, but that copy may not exist immediately. [Immutable IDs with sending](https://learn.microsoft.com/en-us/graph/outlook-immutable-id).

`sendMail` returns `202 Accepted` with no response body; this confirms submission acceptance, not completion or recipient delivery. Its default saves to Sent Items. **Design implication:** represent pending/submitted/failed/uncertain states accurately, reconcile Sent Items, and avoid blindly retrying an ambiguous send timeout (a duplicate external email is possible). A Sent Items copy is not proof of delivery to every recipient. [sendMail contract](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).

Files under 3 MB use an attachment POST; 3–150 MB use upload sessions, subject to mailbox/message-size limits. Microsoft also documents a known issue for large uploads to shared/delegated mailboxes. Upload URLs are preauthenticated bearer capabilities: keep them out of logs. Recommend a deliberately small first-version upload limit and test the selected mailbox/auth path before promising large files. [Large attachments](https://learn.microsoft.com/en-us/graph/outlook-large-attachments).

## History, search and operating limits

Mailbox message listing includes Deleted Items and supports pagination. Fetch selected metadata for lists and bodies on opening; use the server's complete next-page URL. Large unbounded payloads can time out. [List messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0).

Message-collection `$search` can search properties including sender/subject/body but returns at most 1,000 results. Treat it as interactive search, not a complete historical backfill mechanism. [Message `$search`](https://learn.microsoft.com/en-us/graph/search-query-parameter). The separate Microsoft Search `/search/query` mail experience searches the signed-in user's own mailbox and does not search delegated mailboxes; do not assume its richer mail-search model fits app-only shared-mailbox access. [Microsoft Search message limitations](https://learn.microsoft.com/en-us/graph/search-concept-messages).

Published Outlook limits currently include 10,000 API requests per 10 minutes, four concurrent requests and 150 MB uploads per five minutes, per app/mailbox combination. [Service limits](https://learn.microsoft.com/en-us/graph/throttling-limits#outlook-service-limits). Respect `429` and `Retry-After`, using exponential backoff if no header exists. Prioritize interactive reads/replies over backfill and coalesce notification bursts. [Throttling guidance](https://learn.microsoft.com/en-us/graph/throttling).

## Decisions and evidence still required

1. Confirm Exchange Online tenant, real mailbox type/identity, administrator access, licensing, mailbox size, nested folders, Online Archive usage and oldest required history. None was inspected here.
2. Decide whether this is a focused staff communication surface or a shared support queue needing assignment, internal notes, resolution/reopening and collision handling. Graph email primitives do not establish those product semantics.
3. Decide who can see this address's entire contents. A company admin mailbox can contain sensitive finance/personnel/security mail; existing portal-wide staff access may be too broad.
4. Define freshness, history retention and deletion behavior: live provider access vs cached metadata vs retained bodies/attachments. Synchronizing a deletion and preserving a business audit trail are separate policy decisions.
5. Define outbound scope: replies only vs compose/reply-all/forward, permitted recipients, shared identity/signature, attachments and concurrent drafts. Verify Outlook-originated replies/sends appear and do not cause false unresolved status.
6. Before implementation acceptance, prove a nonproduction mailbox end-to-end: forbidden-mailbox denial, replies threaded correctly, draft/Sent Items correlation, external delivery/bounce behavior, shared-mailbox attachment limits, Outlook moves/read changes, missed subscription recovery, expired delta rebuild and ambiguous-send handling.

No tenant-specific permission compatibility, delivery guarantee, mailbox volume estimate, cost estimate or working credential setup is claimed by this research.
