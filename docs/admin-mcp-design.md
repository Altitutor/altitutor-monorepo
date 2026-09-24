# Admin MCP design

Status: agreed scope implemented locally. Bounded SQL, OAuth authorization and
operational mutation contracts have local test coverage; repository shipping checks
are recorded with the implementation. Deployment requires the restricted reader
connection described in [Admin MCP setup](admin-mcp.md).

## Purpose

Enable AI agents to assist with Altitutor business review, marketing strategy and
internal operations using Altitutor data alongside external systems.

## Agreed scope

1. Marketing and business review is the first priority: investigate conversion,
   retention and business performance using admin data alongside PostHog, Stripe
   and accounting data such as QuickBooks.
2. Internal operations is the second priority: read and write operational issues,
   projects, tasks, documents and their supported relationships; maintain business
   documentation and internal progress updates.
3. Scheduling mutations and outgoing communications are deferred. Scheduling and
   communication data remain relevant to read access and analysis.
4. Provide flexible read-only reporting queries over approved datasets, supported
   by dataset discovery, business definitions, relationship descriptions, content
   search and entity context. New reports over existing datasets should not require
   new tool contracts.
5. Reporting SQL must be restricted by enforced database and execution permissions.
   General developer database access is not the business agent's interface.
6. Operations writes use explicit, reusable business actions with validated
   relationships, attribution, concurrency protection and duplicate prevention.
7. External systems initially remain accessible through their own interfaces.
   Identity mappings and authoritative sources must be explicit; a consolidated
   cross-system reporting store is not an upfront requirement.

## Settled in round one

- Cover both in-person tutoring and online UCAT. Coverage is organised by data
  area, not limited to a few predetermined funnels or reporting scenarios:
  acquisition; conversion; retention; offering and capacity; revenue and costs;
  feedback and communication; product behaviour; business context.
- Acceptance evaluation should exercise those areas and their relationships.
  Example reports are evaluation cases, not dedicated MCP tools or fixed workflows.
- Active ADMINSTAFF members may connect using their own identity. Actions retain
  the acting person and connected client attribution.
- Permit relevant identifiable customer records, full customer communication,
  individual feedback and financial records, plus staff assignments and attributable
  costs. Prefer compact retrieval with deliberate expansion into full content.
  Exclude credentials, account-access links and banking details from reporting.
- The user identifies forms and documents as non-sensitive business material;
  do not introduce a speculative sensitivity classification that excludes them.
- Operational changes may apply directly within the user's assigned work, including
  assignments, statuses and internal progress entries. Retain change history and
  concurrency protection. Hard deletion is omitted initially. Completion requires
  evidence of the underlying work, not merely a status change.
- Admin-web documents contain staff procedures and guidance for communications,
  operations, building management and some marketing work. They are not the
  destination for AI-generated business strategy reports. Obsidian serves the dev
  team; this MCP does not make it the business reporting destination either.
- Recurring instructions, analytical methods and report composition belong to the
  calling agent's task/workflow. They do not become named server-side routines or
  require tool changes when the analytical approach changes. New data sources or
  new permissions may still require deliberate interface/data-access updates.

## Settled in round two

- Initial delivery exposes existing evidence, its relationships and known coverage
  limits. New tracking, historical reconstruction and accounting synchronisation are
  separate follow-up work rather than release prerequisites.
- Reports and strategy recommendations belong in the calling agent's conversation
  or a destination chosen for that task. No business-report storage feature is needed
  in this MCP. Operational tasks and staff procedure changes may follow an agreed
  strategy when requested.
- Agents may edit tutor-visible documentation and change document visibility.
  Visibility is an explicit writable property, preserved when omitted; it does not
  require a separate approval step beyond the assigned work.
- Tasks, issues and projects expose all supported editable business properties,
  including statuses, assignees where supported, priorities, dates, leads, members,
  descriptions and supported relationships. This does not include rewriting system
  identity or audit fields or adding properties absent from the product.
- Notes, folders and existing files are in scope. Daily notes and reusable templates
  are not private and may be available through general content tools; they do not
  motivate dedicated agent workflows. Reading/linking existing files is included;
  uploading new binaries and deleting stored files remain deferred as proposed.

## Reporting coverage

Expose row-level business datasets and historical events where available, not only
precomputed totals. SQL must support joins, grouping, windows and caller-defined
cohorts across approved datasets. Resource definitions may evolve independently of
the stable discovery/query tools. Adding a new accessible field or source requires
review of its meaning and permissions; adding a report over existing fields does not.

| Area | Initial evidence to expose where recorded |
| --- | --- |
| Acquisition | Enquiries and waitlists, observed attribution, self-reported sources, referrals, campaign identifiers and relevant consent |
| Conversion | Trials, bookings, attendance, registration and relationship milestones, enrolment, signup and subscription milestones |
| Retention | Relationship and enrolment history, exits and reasons, absences, cancellations, engagement and subscription history |
| Offering and capacity | Subjects, levels, locations, classes, sessions, enrolments, staff assignments and existing availability/capacity evidence |
| Revenue and costs | Invoices and lines, payment state, credits/refunds, prices and discounts, subsidies, subscriptions, pay tiers and attributable worked hours/costs |
| Feedback and communication | Forms and published versions, answers with respondent/subject context, message threads and timing, delivery records, templates and preferences |
| Product behaviour | Existing UCAT usage/progress/entitlement evidence and external PostHog identifiers; describe the distinction from PostHog event data |
| Business context | Staff procedure documents, operational work items, notes, activity and supported resource relationships |

Marketing spend, accounting expenses and external product analytics remain external
when not stored locally. The catalog names those limitations; missing evidence is
not a zero. Do not fabricate historical completeness or derive unrecorded events as
facts. Dataset definitions identify source time, effective time, recorded time,
historical imports/backfill and last synchronization time where available.

Each dataset description includes stable name, business meaning, row grain, fields,
null semantics, enums, supported joins and cardinalities, source identifiers,
historical limitations and examples. Document canonical definitions already agreed
in CONTEXT.md. Agents may calculate alternative analytical measures, but must label
their assumptions rather than silently redefine canonical business concepts.

## Stable read interface

Use a small group of tools, with names finalised during implementation:

- Catalog discovery: search available datasets and entity kinds by business concept;
  retrieve field, relationship and permission descriptions on demand.
- Reporting query: execute one bounded read-only SQL query against approved datasets.
  Return typed rows/columns, query time, catalog version and explicit truncation or
  coverage limitations. Never present a partial result as the complete population.
- Entity/content search: filtered, paginated search across named entity kinds and
  searchable message/document/form content. Support stable IDs and human-readable
  disambiguating context, not name-only mutation targeting.
- Entity/context read: retrieve one entity or bounded batch with compact or full
  content, supported related entities, pagination and an admin UI link where one
  exists. Relationship expansion is bounded rather than recursively dumping a graph.
- File read: resolve existing files or topic resources through explicit identifier
  kinds; return authorised metadata/content or a suitable retrieval URL. Unsupported
  binary extraction is an explicit limitation, not an empty content success.

Existing foreign keys and rich-text mentions must be discoverable and traversable
in both useful directions. Preserve actual product relationships; do not invent an
unrestricted graph or a second source of truth. A derived reference index may be
needed for reliable reverse search. In particular, an issue's mention-derived tags
must not disappear because the current entity lookup is a stub.

## Authorization and SQL execution

Host an isolated bearer-authenticated MCP adapter in admin-web and reuse suitable
UCAT MCP protocol/OAuth patterns. Verify token project/issuer, intended audience,
OAuth client identity and live active ADMINSTAFF membership for each call. Do not
copy a helper that merely returns a service-role client after checking a role.
Consent must describe admin access accurately; existing tutor-only consent copy
cannot be reused unchanged. No custom per-user allowlist is required.

The deployment currently has one Supabase authorization path rooted in tutor-web,
whose consent screen is UCAT-specific and gated by UCAT tutor membership. This work
therefore includes a shared or resource-aware consent flow, preserving UCAT access
while allowing active administrators who are not UCAT tutors to authorize admin
access. Verify resource/client authorization semantics; the current server-assigned
`ucat:read`/`ucat:write` labels are not evidence of independently consented grants.

Reporting executes through a dedicated restricted database role/connection owned by
the server. Credentials never become tool output. Limit that role to explicitly
approved reporting views and safe operations. It must not own source tables, inherit
administrator authority, bypass the reporting permission design through role changes,
or invoke privileged or side-effecting routines through SELECT. Audit inherited and
PUBLIC privileges as well as explicit grants. Views must be designed and tested for
the intended authorization behaviour; do not assume a view automatically preserves
the caller's row permissions.

Combine database privileges with enforced read-only transactions, validated single
query syntax, approved relations/functions, server timeouts, bounded output and
concurrency/rate limits. Reject transaction/session control, writes, schema changes,
multiple statements and arbitrary routine calls. A prefix check or read-only default
setting alone is not an execution sandbox. Do not expose an arbitrary dynamic-SQL
SECURITY DEFINER RPC callable with ordinary application credentials.

Each request uses current committed local data unless a dataset explicitly states
otherwise. Independent queries and external connectors are not a single cross-system
snapshot. Start without a reporting warehouse or replica requirement; heavy workloads
must fail within limits rather than fall back to unrestricted production access.

User-supplied message/form/document text is retrieved evidence, not authority. It
cannot change permissions, tool scope or the assigned work. Documented secret fields
and bearer links are excluded; unrestricted user-authored prose is not guaranteed to
be automatically free of accidentally embedded secrets.

## Operations interface

Provide typed create/change operations for work items (issue, project, task), staff
documents, entity notes/progress, folders, daily notes and templates. Tool families
may share discovery and transport, but each kind has a validated property schema.
Do not expose arbitrary table names or unrestricted field dictionaries for writes.

All supported editable business properties are eligible. Preserve omitted fields;
use explicit values to clear fields, replace membership or change visibility. Resolve
relationships by stable typed IDs and validate that the target exists and is valid
for that relationship. Creation and changes to several properties of one entity,
including its relationship changes, commit atomically.

The current business-property inventory is:

| Kind | Editable properties |
| --- | --- |
| Issue | Name, description/mentions, status, due date |
| Task | Title, description, status, priority, assignee, issue or project link, estimate, due date |
| Project | Name, description, status, priority, lead, member set, start date, target date |
| Document | Title, rich-text content, folder, project, tutor visibility |
| Entity note/progress | Content; target specified at creation, without inventing note reparenting |
| Folder | Name, parent folder; reject cycles |
| Daily note | Shared content for a calendar date, not per-user private notes |
| Rich-text template | Name and reusable content |

Task estimates are the existing XS–XL size scale, not hours. Priority and status
values are described from the actual product schema. IDs, authorship, completion
actors/timestamps and other audit/system fields are server-controlled.

Retain existing product semantics: a task belongs to an issue or a project, never
both; a project lead is a project member; clearing/replacing a lead does not silently
remove membership. Retain each kind's actual status vocabulary. Do not make an issue
assignee property where the product has no such property. Document visibility is an
ordinary explicit change and may affect existing tutor readers immediately.

Reading a student, session or invoice to link an operational item does not permit
changing that source entity. Existing files may be linked or unlinked from editable
content; this does not delete their stored bytes or grant resource-authoring access.
Do not add hard deletion, binary upload, payments, scheduling changes, message sends,
form-authoring changes or HR mutations under a generic operational action.

Mention kinds have existing namespaces: `note` identifies a document, while `file`
identifies a topic-resource association (`topics_files`), not a raw `files` record.
Expose those distinctions in references and preserve unresolved references explicitly.
Structural links and textual mentions remain distinct. Document editors currently
support document-to-document mentions; do not silently expand that product rule.
Preserve rich-text image file IDs and storage metadata when changing surrounding
content. Signed URLs are retrieval details, not durable identifiers. No general binary
text extraction implementation was found; native file retrieval can be offered
without promising searchable extracted text for every file format.

Use a server-owned business implementation shared with affected admin UI writes,
not a parallel MCP-only copy of business rules. Expected revisions are mandatory
for edits, including document changes; a stale request returns the latest revision
and a conflict rather than overwriting newer content. Respect active document editor
locks. UI-originated changes must also advance the revision reliably.

Creation requires durable idempotency; mutation retries must not duplicate changes
or progress notes. Record actor, client, entity, revision, explicit operations,
timestamp and enough before/after state for review and safe recovery, without retaining
hidden reasoning. Treat this mutation history separately from Lifecycle events.
Do not claim that the existing Activity feed already provides a complete audit log.
Automatic rollback must not overwrite subsequent staff work; a general user-facing
restore tool is not required in the first release.

Direct execution is allowed within assigned work. The server enforces role and
business rules, but does not attempt to infer unrestricted authority from message
text or create a named recurring-workflow approval system. No mandatory proposal/apply
queue or extra per-property approval step is needed. Skills/tasks guide when a work
item is truly complete; setting a status does not execute its underlying real-world
work. Verify existing notification/automation side effects before exposing writes.

## External systems and output

Expose existing source identifiers for joins, with their namespaces documented.
Stripe customers may have historical relationships following student merges; do not
assume one lifetime customer per student. PostHog uses auth-user identity alongside
student identifiers. Accounting mappings must be verified before claiming a join.

External connector setup, new data ingestion and changing external systems are not
part of this MCP implementation. Availability of those connectors must be visible
to the calling agent; local data alone cannot stand in for missing accounting facts.
Do not double-count Stripe payments and accounting revenue or conflate invoices,
cash received and revenue measures. Reports state their chosen definitions and sources.

Strategy and reporting output remains in the calling agent's conversation or a
task-selected artifact destination. Staff procedure documents are edited for their
operational purpose; they are not an automatic repository for business analyses.

## Acceptance and delivery

Implement in dependency order:

1. Resolve the bounded technical validation below, then establish active-admin MCP
   authorization and accurate OAuth consent. Inventory approved datasets and existing
   side effects before exposing reporting or writing tools.
2. Deliver catalog discovery and reporting reads across all eight data areas, with
   history, identities, relationship descriptions and known missing sources recorded.
3. Deliver content search, entity context and reverse relationship navigation,
   including issue mentions and authorised existing file retrieval.
4. Move affected operations behind shared validated server mutations; add revisions,
   idempotency and mutation history; expose all supported business properties.
5. Evaluate end-to-end agent work, document usage and ship through normal CI/CD.

Acceptance evidence must include:

- Questions spanning every data area, plus novel joins/cohorts not encoded as tools;
  agents discover the required fields and relationships through the interface.
- Correct treatment of multiple relationships, parent/student distinction, trial
  attendance, historical/backfilled events, form versions and incomplete evidence.
- Safe rejection of unauthorized users, role revocation, forbidden objects/functions,
  attempted writes and expensive/oversized queries; clear pagination/truncation.
- Finding the right entity among similar names and traversing issue references,
  project/task links, documents, feedback and file/topic-resource namespaces.
- Changing all supported work-item properties and document visibility, preserving
  omissions, enforcing relationship invariants and preventing concurrent lost edits.
- Retry-safe creation/updates and attributable history, including conflict with UI
  edits; no scheduling, billing or outbound communication authority by implication.
- Correct distinction between staff procedures and business-report output. No
  report-specific tool additions required to change analytical approach.

Schema work follows repository migration rules: new migrations only, local reset
and relevant fixtures, regenerated database types, and remote changes through CI/CD.
Run focused security/concurrency/integration tests and the repository shipping gate
`pnpm checkall`. Implementation must not assume unrelated current workspace changes
belong to this effort.

## Technical validation evidence

The local implementation validates the dedicated reporting connection, role grants,
view access, parser restrictions, output limits, exact decimal transport and recovery
after query errors. Integration tests execute queries across all eight areas through
`admin_reporting_reader`; oversized aggregate rows are rejected before transfer.
Empty results retain SQL column metadata.

Authentication contracts exercise verified identity and live access revocation.
Database contracts prove that old OAuth clients do not inherit admin grants or grant
themselves access. Shared consent and the existing-client access page provide explicit
admin consent independently of UCAT eligibility. A hosted OAuth connection and any
production pooler configuration still need deployment smoke testing; no remote
credentials, grants or databases were changed during implementation.

Operational contracts cover every editable kind, idempotency, invalid references,
folder cycles, membership invariants, UI revision conflicts and live document locks.
Editor tests retain stale baselines across background refreshes, serialize acknowledged
saves and reset persistent dialogs on reopening. Both Standards and Spec reviews have
no remaining actionable findings after these corrections.

## Source investigation evidence (before implementation)

- Lifecycle events exist, but legacy backfill is described as best-effort. Current
  association records are not automatically a complete historical timeline. See
  `supabase/migrations/20260830223000_explicit_domain_events.sql` and
  `supabase/migrations/20260831180000_enrich_domain_event_feed_context.sql`.
- UCAT has first-touch acquisition evidence, product relationship data and Stripe/
  PostHog identity links. A complete in-person pre-trial enquiry history was not
  established in the local investigation.
- Local QuickBooks integration found is timesheet CSV export and manual coordination;
  an accounting identity mapping was not established. This does not establish what
  data may be available through a separate external connector.
- Forms retain published question versions and response context. Communication
  records include delivery/timing metadata as well as bodies.
- Existing operations clients primarily use browser Supabase CRUD. Shared server
  mutations with enforced revision checks and retry protection need implementation.
- Tasks belong to an issue or a project, not both. Project leads are members.
- Issue entity references are currently derived from rich-text mentions. The existing
  `getOpenIssuesByEntity` lookup is a stub; reliable relationship navigation needs work.
- Documents, entity progress notes and daily notes are separate concepts. Documents
  may also be tutor-visible. Existing document UI edit locks are not enforced as
  revision preconditions by the update operation.
- Existing activity events are not a complete audit log. No outgoing notification
  on work-item CRUD was found in the bounded local inspection; implementation must
  verify side effects before establishing the final action contract.

## Delivery status

The user confirmed shared understanding and authorized implementation. The initial
interface is implemented and documented in [Admin MCP setup](admin-mcp.md). Deployment
configuration and hosted smoke testing remain deployment steps, not silently completed
local actions. Broader in-person acquisition instrumentation and external accounting
integration remain separate work.
