# DEV-250: email management research and discussion

Research v8 · 29 October 2026 · B v2 UX accepted, with explicit native admin-web UI requirements and consolidation of existing operational email features.

Repository inspected at `298c6e695e4167d4e6d3726e09979de0d87388f7`.
Macro inspected at `602691bb85f6f33574977fb909b9cddc18c53034`.
The product policies and native UI direction below are accepted. Implementation is in progress; no working live mailbox integration is claimed.
No live mailbox, tenant credentials or production email were inspected; no messages were sent.

## Recommendation

Build an Altitutor-owned shared mailbox feature backed by Microsoft Graph. Keep Exchange authoritative for actual messages, folders and mail operations. Add Altitutor context and, if the business needs it, responsibility/follow-up state beside that mailbox. All active ADMINSTAFF have access, as requested. Keep personal staff mailboxes out of the first delivery while preserving a mailbox identity in the model.

## Agreed goal and cross-client behavior

Matthew confirmed that admin-web will be where staff do all routine `admin@` email. Outlook remains a fully usable client of the same mailbox. Reading or marking unread, moving messages between folders and replying in Outlook must be reflected in admin-web; admin-web operations must likewise affect that mailbox so Outlook sees them.

Acceptance must cover shared read state, moves preserving message/thread identity, Outlook-originated replies appearing in the correct conversation, and admin-web operations visible in Outlook. The accepted target is normally under a minute, with last-sync/error/manual refresh visible; cached reading may work offline, but writes/sends require a connection and honest pending/uncertain states. Shared drafts include detected-conflict warnings and recoverable text, with simultaneous Outlook edits still subject to verification. No live cross-client verification has been performed.

## Agreed thread responsibility and DEV-151 boundary

Matthew confirmed this complete lifecycle: assign one active AdminStaff to a thread and notify them; reading in either client preserves responsibility; incoming follow-ups before a staff reply retain assignment and notify the assignee; any staff reply through either client clears responsibility; subsequent incoming mail is unassigned until explicitly assigned again. Read/unread stays shared with Outlook.

He wants parity with [DEV-151](https://linear.app/altitutor/issue/DEV-151/ability-to-assign-conversations-reply-to-an-adminstaff), while explicitly directing this agent not to work on that issue because another agent owns its worktree. It was read only. At the reference read, its description/workpad cleared assignment when read **or** replied. Matthew confirmed the email lifecycle above after this mismatch was highlighted. That settles DEV-250; it does not change DEV-151 or authorize work/messages in its scope. Do not claim implemented parity until the other work is independently reconciled and verified.

This lifecycle is agreed but not implemented. A fictional state-model sandbox will demonstrate it alongside the remaining independent policy choices; it does not prove live Graph behavior, notification delivery or cross-client synchronization.

## Accepted correspondence policies (Q4–Q6)

Matthew accepted the recommendations demonstrated by workflow prototype v1 (SHA-256 `04bca0769fe8813f97461a91f0f8cdd914ad7899de1ba91f383e602783126180`):

- **Record links:** uniquely matched direct participants link to their own Student/Parent records automatically. Staff explicitly link children or other relevant context; a Parent relationship alone never rolls every thread onto all children. Ambiguous participant matches require review rather than an arbitrary automatic choice.
- **Sender/signature:** routine staff correspondence uses `Altitutor Admin <admin@altitutor.com>` with the real replying AdminStaff member's signature. Replies still return to the shared mailbox. Canonical automated-message authorship remains with its domain.
- **Operational history:** enrolment confirmations, absence acknowledgements and invoice notifications appear in shared Sent and directly relevant Activity, including when generated automatically. Preserve canonical content/eligibility and reconcile mailbox/provider records to avoid duplicate history. Identity/security email and UCAT campaigns keep their existing domain workflows. This approves the product result, not an untested delivery/copy transport.

The agreed terms are in CONTEXT.md and the ownership boundary is recorded in ADR 0062. The standalone workflow prototype is attached to DEV-250 Resources. Capture it on a throwaway branch through the required commit gate; it must not ship as production implementation.

## What the repository already provides

- **A narrow Exchange reader:** onboarding has an app-only Graph importer for `admin@altitutor.com`, immutable message IDs, per-folder delta cursors and a five-minute cron definition. It imports plain text and links mail to onboarding journeys. Whether it is configured/running remotely is unverified.
- **No general mail client yet:** that importer does not retain folder/read/attachment state, skips drafts/removals, and does not send replies or mutate Exchange. Local onboarding “ignore” is not archive. Its documentation about opening email drafts externally appears stale against the current UI.
- **Separate outbound systems:** canonical transactional messages use `@altitutor/email` and Resend; SMS/iMessage uses another composer/transport. An email address in the latter can be an Apple ID. These are useful integration seams, not interchangeable email transports.
- **An existing Activity contract:** Activity projects explicit business lifecycle events. Importing, reading or moving every email should not automatically turn those provider changes into business events. Correspondence needs explicit links/projection rather than bypassing that contract.

The [repository audit](./dev-250-existing-email-paths.md) contains pinned code references. [ADR 0024](../adr/0024-centralised-email-presentation-and-message-ownership.md) preserves canonical email content and provider-neutral rendering; [ADR 0036](../adr/0036-drive-admin-activity-and-automation-from-lifecycle-events.md) defines Activity semantics.

## Microsoft feasibility

For an Exchange Online primary/shared mailbox, a server connector can operate independently of each employee's Microsoft login. Prefer Exchange Application RBAC restricted to `admin@` for reads/writes/sends. Separate broad Entra permission grants remain additive, so a scoped role alone does not prove restricted access. Test the permitted mailbox and denial on an unrelated mailbox. [Microsoft Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

Synchronize a modest message index for fast lists, then load bodies/attachments on demand if that meets the accepted history needs. Use stable IDs, per-folder change cursors, periodic reconciliation and cursor-reset recovery. Webhooks can improve freshness but require renewal and missed-notification recovery. This cache size and freshness recommendation remains subject to the business requirement. [Delta synchronization](https://learn.microsoft.com/en-us/graph/delta-query-messages), [immutable IDs](https://learn.microsoft.com/en-us/graph/outlook-immutable-id).

Use genuine provider reply drafts, then submit them and reconcile Sent Items. Submission acceptance is different from recipient delivery; an ambiguous send timeout must not trigger a blind duplicate send. [Reply drafts](https://learn.microsoft.com/en-us/graph/api/message-createreply?view=graph-rest-1.0), [sendMail contract](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).

Exchange Online eligibility, mailbox type, licensing, administrator access, existing folder/history volume and Online Archive usage are unverified. Graph mail does not expose in-place archive mailboxes. Those are later setup/feasibility checks, not questions to guess at from an Outlook email address. [Mail API overview](https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview).

See the [Microsoft report](./dev-250-microsoft-graph.md) for evidence and operating limits.

## What to take from Macro and Superhuman

Macro is useful for the reading-pane/focus model, keyboard navigation, stable list position, clear sending identity, serialized draft persistence and honest recovery from uncertain sends. Its current repository contains Outlook code, but the Outlook design status still records pending live verification and disabled-by-default switches. Its documented Microsoft scope excludes native shared/delegated mailboxes. It is therefore not a demonstrated drop-in solution for this ticket. [Pinned status](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/design/outlook-email-support.md#L1-L112), [supported mailbox scope](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/agent-guide/email.md#L48-L104).

The repository is AGPL v3. This research recommends describing desired behavior and implementing within Altitutor; it makes no legal compatibility conclusion about copying source. [License](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/LICENSE.txt). The [Macro report](./dev-250-macro-reference.md) identifies precise references.

Superhuman's shared snippets and split-inbox concepts are useful inspiration. They do not settle shared responsibility: reading an email is different from handling the request. [Snippets](https://help.superhuman.com/hc/en-us/articles/46005686571149-Snippets), [Inbox Reboot](https://help.superhuman.com/hc/en-us/articles/46005871728013-Inbox-Reboot).

## Agreed first-delivery boundaries

1. **Mailbox:** messages, folders, drafts, replies, attachments and Exchange reconciliation.
2. **Altitutor correspondence:** unique direct participants link to their own records automatically; staff explicitly select child/other business context. Household roll-up is excluded.
3. **Staff work:** thread assignment, assignment/follow-up notifications, read-independent responsibility and reply-based clearing are agreed. Personal mailbox management, internal notes, snooze and additional waiting/done states are outside the agreed first scope; draft editing warnings and recovery are included.
4. **Business notifications:** core operational emails are mailbox-visible and appear in directly relevant Activity. Existing domain workflows retain eligibility/content ownership; identity and UCAT campaigns remain separate. A shared From address does not put Resend sends in Exchange Sent Items; actual delivery/reconciliation must implement the accepted visibility result without duplicate history.

The agreed **Shared admin mailbox** and **Email thread responsibility** terms, including the confirmed assignment lifecycle, are recorded in CONTEXT.md.

## Discussion tree

**Settled:** admin-web is the routine email workspace; Outlook continues to work with shared mailbox state and reflected replies/moves/read changes.

**Settled:** one AdminStaff can be assigned to an email thread and receives an assignment notification; responsibility is separate from shared read/unread. DEV-151 is reference-only and remains owned by the other agent.

**Settled:** reading preserves responsibility; incoming pre-reply follow-ups retain/notify; any staff reply in either client clears responsibility; subsequent inbound is unassigned. No DEV-151 work is authorized.

**Settled:** Q4 unique direct-participant record links with explicit child context; Q5 shared From with actual staff signature; Q6 mailbox-visible core operational messages with domain-owned content/eligibility.

**Settled Q7–Q9:** Matthew chose B, asking to make UI/UX as close to Superhuman Mail as possible, and accepted the proposed routine scope, primary-mailbox history and freshness recommendations. No repeat decision is needed for Q1–Q9. Current checkpoint: try the closer B v2 UX through the working private preview address before the production rewrite.

**Prototype ready:** three actual-admin-shell variants are built and inspected using an owned disposable runtime and fictional in-memory mail. [Comparison board](http://matthews-mac-mini-8.tail882d1c.ts.net:4387/session/760b531a64dce177). A keeps folders/list/reader together; B opens a wide focused conversation from a compact inbox (recommended); C keeps responsibility/context in a separate panel. The interactive route is local to this Mac at http://localhost:64754/email-prototype?variant=B and lives only while its tracked process/host remains running. The board shares screenshots through the existing Lavish service; it is not a remote live-mail integration.

**Q7 accepted:** B, refined toward Superhuman Mail UI/UX.

**Q8 accepted:** admin@-only routine-mail scope: folders/threaded read, new/reply/reply-all/forward, attachments, search, autosaved shared drafts, archive/delete, shared templates, staff signatures and the agreed assignment/Activity behavior. Drafts are visible to mailbox users in Outlook, with portal editing warnings and recoverable text for detected conflicts. Simultaneous Outlook draft edits remain an integration limitation until the probe below is verified. Personal mailbox management, internal notes, snooze and additional waiting/done states are outside the accepted first scope.

**Q9 accepted:** all existing primary-mailbox history, recent-first progressive loading, and a normal under-a-minute synchronization target with visible last-sync/error/manual refresh. Online Archive availability and actual mailbox size remain setup facts to verify. Offline reading may use already-loaded data, but sends and mailbox mutations require a connection and honest pending/uncertain state.

Confirm shared understanding before implementation. Keep approved outcomes in Linear; update glossary/ADRs only for resolved terms/trade-offs. No product implementation or delivery is approved by this research.

## Draft concurrency evidence and acceptance probe

Graph v1.0 [PATCH message](https://learn.microsoft.com/en-us/graph/api/message-update?view=graph-rest-1.0) does not document an If-Match precondition or stale-version rejection contract. The [message resource](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0) documents changeKey as a version, which alone does not prove compare-and-swap semantics. A separate [Copilot Studio preview tool](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-mail-tools#mcp_mailtools_graph_mail_updatemessage) exposes If-Match, but does not prove the exact app-only v1.0 behavior. The [send-draft endpoint](https://learn.microsoft.com/en-us/graph/api/message-send?view=graph-rest-1.0) likewise does not establish a version precondition.

Use portal editing coordination/version metadata, preserve unsaved text and detect provider changes before resuming. A read-compare-write still has a race; do not promise complete protection from simultaneous Outlook edits. Before claiming provider-level protection, use a nonproduction mailbox: read A, change to B through another client, attempt PATCH with A's returned ETag, verify rejection and unchanged B, then verify PATCH with B. Test sending separately. No such probe has run.

Provider drafts are shared mailbox items, not private per-staff drafts. Keep actual portal author/editor attribution in access-controlled Altitutor metadata; sender/from cannot reliably identify the staff actor. [Create draft](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0), [shared-mailbox access](https://learn.microsoft.com/en-us/microsoft-365/admin/email/create-a-shared-mailbox?view=o365-worldwide).

## Prototype verification checkpoint

Actual seeded active-admin authentication and shell were exercised. Fictional actions checked: assignment, Outlook-read preserves assignment, pre-reply inbound retains/notifies, explicit child link excludes sibling, reply template uses real newlines, simulated reply clears assignment/adds Sent, and new compose adds Sent. A/B/C screenshots and a light/mobile pass were inspected; no live Graph account, mail send or production setting was used. No console errors were reported on the prototype route. Focused ESLint and admin TypeScript checks passed.

The unmodified full pnpm check failed in unrelated admin test suites on two runs. Focused rerun of the first three failed suites passed (3 suites/9 tests). Full admin tests passed with resource adjustments: CI=true pnpm --filter admin-web test --runInBand --testTimeout=15000 (259 passed suites, 1 skipped; 1850 passed tests, 6 skipped). This does not claim the default command passed. No commit, production implementation, PR or shipping gate is complete. Prototype branch archival remains pending the required commit gate and final UI verdict.


## B v2 UX and preview access

[Playable B v2](http://matthews-mac-mini-8.tail882d1c.ts.net:4387/session/55299c1c8634b479) is served through the same existing private Lavish service that serves the working board. Turn Annotate off to interact. It is a portable, in-memory UX prototype with an explicitly illustrated portal shell. The identical HTML mail source is mounted inside the actual authenticated admin-web shell on the local B route. This is no new server/network/credential mechanism and is not live Graph functionality.

The earlier localhost failure could not be reproduced on the development host. Owned runtime status remained ready, TCP listener was on 127.0.0.1:64754, a network-unrestricted request returned the expected auth redirect (307), and the exact localhost URL opened successfully with the seeded admin session. A sandbox-network request failed; that is not evidence of app failure. Existing Tailscale Serve config is empty. The actual app has no verified remote route. User device/location is still unconfirmed; the earlier localhost link was inappropriate for portable review. B links on the old comparison board now point to the portable interactive preview.

Refinements: compact desktop rows, keyboard selection separate from opening/read state, focused conversation, contextual drawer, command menu/search, shortcut hints and Inbox/Assigned to me/Unassigned filters. Keyboard actions include J/K, Enter/Esc, C/R/Shift-R/F/E/U, G-I/G-T/G-D/G-E and Cmd/Ctrl-K; Cmd/Ctrl-Enter sends only a simulated message. Source references: [official shortcuts](https://download.superhuman.com/Superhuman_Keyboard_Shortcuts.pdf), [split-inbox guidance](https://help.superhuman.com/hc/en-us/articles/46005619081101-Default-Split-Inbox). This adopts interaction patterns within the agreed scope, not every Superhuman feature.

Verified the remote Lavish session renders and responds in Explore mode; J/K, Enter/Esc, command filtering→Sent, assignment and simulated reply were exercised. A complete DOM-control lifecycle check against the same source confirmed read retains Chris, incoming retains/notifies Chris, staff reply clears, later incoming remains unassigned. Folder chords and selection preserving unread also passed. The first remote scripted chord check exceeded the 900ms chord window and did not switch folders; immediate browser events passed. No broken behavior was inferred from that automation timing.

B v2 source is `apps/admin-web/src/features/email/prototype/DEV250-focus-mail-v2.prototype.html`; the dev-only `/email-prototype/focus` endpoint serves it and the B iframe embeds it without the illustrated outer shell. No prototype commit/archive is claimed while the default commit gate remains unresolved.


## Accepted native UI requirements (29 October)

Matthew accepted the B layout/UX/functionality and requested native admin-web presentation. No further A/B/C selection is open.

- Selected rows: `bg-muted`, rounded corners; no left accent border.
- Tabs: `SegmentedControl`. All / Assigned to me / Unassigned are builtin saved views using the existing toolbar/Display pattern, not a separate split-inbox control.
- Subject and muted preview inline. Assignee is a list column with inline searchable editing, and a task-style pill at the top of the conversation.
- Use `SearchableSelect` for selection dropdowns; `AdminDialogShell` for compose and other dialogs. Composer footer follows Messages: templates/attachment/sender on left, Send on right. Preserve canonical email rendering and sender rules.
- Conversations open in the existing global expandable right accessory panel as independent native tabs, exactly like SMS conversations. The local split pane in the prototype is only a fixture. Do not substitute the existing Messages tab, which mounts a live SMS/iMessage interface.
- Integrate email actions with the existing global command palette and local record/page scopes; do not ship a separate email command menu.
- Known participant names open Student/Parent/Staff pages through existing navigation. Unknown participants offer searchable contact create/link actions analogous to Messages.
- Optional Activity in the thread follows the Messages pattern, constrained to agreed direct/explicit context links.
- Microsoft is the source of truth for folders, including folders created in Outlook. Drag a mail row onto a folder to move it through the mailbox command interface; do not create an independent local folder hierarchy.

The prototype checkout was fast-forwarded from 298c6e695e4167d4e6d3726e09979de0d87388f7 to develop 8b12115fa240a50a5923fc62ac769f7659efc866 to access current patterns. Task-owned glossary edits were preserved/restored through stash 1a2531c5ee27da17a2c0a18338dff0bef59fc6b5; all prototype files retained. This does not include a new task commit.

Native APIs verified: `DataTableToolbar`/`EntityToolbar`, `ToolbarSavedViews` + builtin read-only view IDs, `SearchableSelect`, `SegmentedControl`, `AdminDialogShell`, task assignee-pill presentation, `EntityNavigation`, Messages contact-link workflow, `EntityCommunicationPanel`, and `Composer` footer. Current develop includes `useRegisterRecordActions`; email needs a supported palette type, native accessory kind/renderer and deliberate list-page scope. Unknown types silently produce no commands.

A new `NativeMailPrototype.tsx` uses actual shared toolbar/views/select/dialog/segmented components with in-memory fixtures. Its right tabs/contact links are UX fixtures, and native `PaletteBrowser` demonstrates candidate email actions separately from global registration. No claim that production accessory/command integration or contact persistence is complete. Saved prototype views use an in-memory adapter so the demo cannot write real presets.

## Accepted consolidation and cutover

Read Linear comment 6f8d373d-f777-40c5-8156-e26465e9fc71: Matthew directs onboarding/trial mailbox sync into unified inbox email-sync, removal of the five-minute `/api/onboarding/mailbox-sync` cron from `apps/admin-web/vercel.json`, preserved onboarding/trial history, and no replacement standalone scheduler. His latest Codex instruction also supersedes primitive overlapping email surfaces with the unified feature.

Retire the separate onboarding sync implementation/endpoint/schedule and MailboxReview list/reader/manual-sync/status after the unified replacement is ready. Adapt JourneyCommunication and TrialStudentsPage email sources to unified thread/message IDs. Preserve explicit New enquiry / Link existing journey / Ignore for enquiry review; receipt alone never creates an enquiry or changes conversion metrics. Onboarding ignore remains its review decision, independent of read/unread, archive and Microsoft folder state.

Preserve explicit `onboarding_email_links` and their `registration_link` / `ucat_link` / `followup` purposes. Existing email history must remain readable, with deduplication on stable provider IDs. Legacy folder delta cursors selected too few fields and skipped drafts/removals; rebootstrap richer reconciliation rather than merely copying those cursors.

Two migration hazards require acceptance coverage: (1) `onboarding_emails_for_journey` currently infers all linked Parent addresses; do not promote historical inferred household matches into explicit child links, and replace future matching with the agreed direct/explicit correspondence model. (2) `onboarding_evidence()` currently reads old email rows/body-token/recipients to establish `registration_link_at`; adapt that successful-send evidence and timestamps before starving/dropping old storage. A draft or mere send submission must not fabricate business completion.

Canonical operational email remains owned by `@altitutor/email` and domain eligibility rules (ADR0024). Adapt routine registration, booking and invoice-notification entry points to common compose/delivery/history rather than keeping competing composers. Preserve automatic billing per-recipient idempotency keys. Security/password resets/account invites and UCAT campaigns keep separate workflows as agreed. Resend sends do not create Microsoft Sent Items merely because From is admin@; the delivery/reconciliation cutover must implement shared history and prevent duplicate sends.

The existing invoice sender emits `invoice.notification_sent`; mailbox observation must not emit it again. ADR0036 Activity semantics remain: no business event for every read/folder/cache update. Node `sendEmail()` returns void while the Edge adapter returns provider identity, so delivery reconciliation needs an explicit result/outbox seam.

Cutover sequence: unified mailbox/message/thread/folder store + legacy compatibility projection; backfill messages/explicit links and verify registration evidence/history; rebootstrap richer sync; switch journey/contact history and domain send entry points; remove old cron/endpoint with a single sync owner; only then retire obsolete UI/hooks/storage through new migrations. No scheduler, production feature or remote database changed during this prototype/research step.
