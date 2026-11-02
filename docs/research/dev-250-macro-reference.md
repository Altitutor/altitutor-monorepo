# DEV-250: Macro as an email reference

Researched 2026-10-28 against public primary documentation and source, pinned to
[`macro-inc/macro@602691b`](https://github.com/macro-inc/macro/tree/602691bb85f6f33574977fb909b9cddc18c53034).
No Macro deployment or live mailbox was tested. Repository documentation is evidence
about implementation and intent, not proof that a feature is enabled in production.

## Recommendation

Use Macro as a reference for interaction design and domain boundaries. Build the
Altitutor mailbox around its own Microsoft Graph adapter and staff authorization.
Do not treat Macro as a ready-made Microsoft shared-mailbox implementation: its
documented Outlook scope explicitly excludes shared/delegated Microsoft mailboxes.
Macro's in-app inbox/thread sharing is a separate collaboration capability.
([Current email guide, lines 69–73](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/agent-guide/email.md#L69-L73))

## Provider support: the qualification matters

- The README advertises Gmail for its email block. That alone understates the
  source at this commit. Both Gmail and Outlook adapters are present, gated by
  Cargo features; Outlook is a Microsoft Graph v1.0 adapter. The email service
  has a Microsoft credential adapter and provider mailbox gateway.
  ([Provider modules](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/crates/email_api_client/src/outbound/mod.rs),
  [Graph implementation](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/crates/email_api_client/src/outbound/outlook.rs),
  [Mailbox gateway](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/services/email_service/src/outbound/email_api/microsoft.rs))
- The current guide describes Gmail/Google Workspace plus **enabled** personal
  Outlook.com and individual Microsoft 365 inboxes, with a common thread,
  search, Signal/Noise, draft, and scheduling interface. This is source-level
  support; it does not establish live availability.
  ([Guide](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/agent-guide/email.md#L48-L104))
- The Outlook design document's status, updated October 4, says implementation is
  awaiting live testing, release approval remains outstanding, and connection,
  sync, and write switches default off. Its later Gmail-only assessment describes
  the earlier foundation and must not override that opening status or current
  source. The document says no live account verification has started.
  ([Status and verification handoff](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/design/outlook-email-support.md#L1-L112))

## Architecture worth learning from

| Area | Verified repository design | Implication for DEV-250 (recommendation) |
| --- | --- | --- |
| Message/thread/compose | Separate message rendering, conversation ordering/pagination, and draft/editor/delivery features. Domain capabilities stop transport DTOs and query/cache details at adapters. | Keep the reader reusable; keep Graph IDs and response shapes out of page components. |
| Sync | The Microsoft mailbox gateway exposes folders, folder changes, and message retrieval. Separate worker loops handle mailbox work, contacts, drafts, projections, commands, settings, watches, and transfers. | Design resumable server sync independently from the staff page and from sending. A page refresh must not be the only recovery mechanism. |
| Draft/send | A serialized autosave queue captures values before waiting, flushes on disposal, and tracks committed saves separately from allocated IDs. Immediate sends use a durable device journal; server acceptance is transactional and attempt IDs provide idempotent admission. Unknown provider outcomes remain locked for reconciliation. | Preserve drafts first; model send acceptance versus confirmed delivery, and never automatically retry an uncertain send. Full offline support can be deferred. |
| Folders/tags | The Outlook plan distinguishes physical folders from non-exclusive categories/tags and gives archive, trash, and folder moves distinct meanings. | Avoid forcing Graph folders into a Gmail-label abstraction. Keep application workflow state separate from provider filing. |
| Search | Cached quick access searches subject and sender metadata; full-text search is a distinct service mode. Cached coverage is bounded, and snippet hits navigate to the matching message. | State what mail has been synchronized and searched. A cached-list filter must not claim complete-mailbox search. |

Sources:
[Feature boundaries and persistence](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/architecture/email.md#L9-L240),
[Outbox](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/architecture/email.md#L503-L586),
[Worker implementation](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/services/email_service/src/mailbox_sync_worker.rs),
[Gateway implementation](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/services/email_service/src/outbound/email_api/microsoft.rs),
[Provider organization semantics](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/design/outlook-email-support.md#L211-L272),
[Search behavior](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/agent-guide/search.md#L33-L45).

## UX ideas to consider, rather than automatically adopt

1. **List plus reading pane, with deliberate keyboard focus.** j/k moves the list
   cursor and updates the pane; Enter transfers focus; Escape returns focus; pane
   and list shortcuts cannot accidentally act on each other's selection.
2. **Fast completion with undo and stable place.** Finishing the current email
   advances to the next row; going Back preserves filters, scroll, and row focus.
3. **Visible sending identity.** Multi-inbox composition explicitly selects the
   From inbox. A shared admin mailbox especially needs a clear sending identity.
4. **Quiet routine progress, explicit failure recovery.** Outlook distinguishes
   pending organization changes, uncertain delivery, conflicts, and revoked access.
   It does not announce every background draft save.
5. **Signal/Noise is an optional product decision.** Macro documents these tabs,
   favorites, reminders, archived mail, and tags. Altitutor should first decide
   whether staff need triage ownership/status rather than importing all these tabs.

The first four are grounded in the
[reading-pane and navigation guide](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/agent-guide/email.md#L377-L418),
[keyboard shortcuts and recovery](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/agent-guide/email.md#L50-L96),
and [sender selection](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/docs/agent-guide/email.md#L1033-L1053).
The prioritization and shared-mailbox implications are recommendations, not Macro facts.

## Reuse constraint and limits

The pinned repository carries GNU AGPL v3 in
[LICENSE.txt](https://github.com/macro-inc/macro/blob/602691bb85f6f33574977fb909b9cddc18c53034/LICENSE.txt).
This research does not determine compatibility with Altitutor's distribution or
hosting model. The recommendation is to describe desired behavior and implement
it within Altitutor, rather than copy source while assuming open source means
unrestricted reuse. Any proposed source reuse needs a specific licensing decision.

Macro does not settle Altitutor's staff membership, assignment, internal notes,
collision prevention, permissions, or Microsoft delegated/shared-mailbox contract.
Those remain product and Graph integration questions; the Microsoft Graph companion
research should supply the provider evidence.
