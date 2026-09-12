# Admin MCP

Admin-web serves the remote MCP at `https://<admin-origin>/api/mcp`. It supports
business reporting for in-person tutoring and UCAT, plus staff operations. The
[design specification](admin-mcp-design.md) defines its scope.

## Connect and authorize

Connect using Supabase OAuth through the advertised protected-resource metadata.
The shared consent page remains on tutor-web. Active ADMINSTAFF members explicitly
check **Allow admin business access**; existing UCAT grants do not gain admin access.
If Supabase reuses an existing OAuth consent, enable the already connected client at
`https://<tutor-origin>/oauth/admin-access`, then retry the admin connection. That
page also revokes admin access immediately. UCAT permissions remain separately
checked by the UCAT endpoint. Deactivating staff denies subsequent admin requests.

## Deployment configuration

Migrations ship through normal CI/CD. No production database mutation is part of
local setup. The migration creates `admin_reporting_reader` without a password;
configure a strong password for this role through your approved deployment process,
and supply its connection URL as the **server-only** `ADMIN_REPORTING_DATABASE_URL`
in admin-web. Never use `postgres`, `service_role`, or another privileged identity:
the executor verifies its database role and rejects misconfiguration.

Use the project's direct connection or supported pooler connection for the dedicated
role. Postgres.js runs without prepared statements and closes each bounded connection.
Use verified TLS for remote connections (for example `sslmode=verify-full` with the
required CA configuration); local development can use the local PostgreSQL port.
Existing Supabase public URL/key settings remain necessary for user authorization.
A deployment without a reporting URL fails reporting requests explicitly; it never
falls back to developer database access.

Hosted invoice PDF links and opaque billing/provider payloads are excluded from reporting
projections alongside credential fields; approved explicit financial fields remain available.

The reporting schema is not exposed through PostgREST. Do not grant the reader
membership in privileged roles. Review effective PUBLIC/inherited grants when adding
extensions or functions. The executor accepts only parsed, approved query structures,
functions and datasets, and serializes the accepted AST rather than executing raw
caller text. Database permissions, read-only transactions, timeouts and output limits
provide additional enforcement.

## Discover and investigate

1. `discover_admin_data` searches the dataset catalog by business concept.
2. `describe_admin_dataset` explains fields, types, relationships and limitations.
3. `query_admin_reporting` accepts novel read-only SQL over `admin_reporting` views.
4. `search_admin_entities` and `get_admin_entity` retrieve relevant records and context.
5. `find_admin_references` resolves reverse mentions; `read_admin_file` retrieves an
   existing authorised file URL. Binary text extraction is left to the calling client.

For example, compare enrolment counts without adding a dedicated tool:

```sql
SELECT c.id, c.name, count(e.student_id) AS enrolments
FROM admin_reporting.classes c
LEFT JOIN admin_reporting.classes_students e ON e.class_id = c.id
GROUP BY c.id, c.name
```

Check actual lifecycle fields before defining an active-enrolment cohort. Counts
across a parent or event association join can multiply records. Monetary amounts
and currencies must be interpreted from their named fields; invoice values, cash
receipts and accounting revenue are different measures.

SQL column types are returned even for empty results. Top-level bigint and numeric
values are decimal strings to preserve precision; use distinct aliases for columns.

Queries accept one SELECT or non-recursive WITH statement, approved built-in
analytical functions, ordinary joins, aggregation and supported window expressions.
Unsupported parser syntax is an explicit error. Relations must be schema-qualified;
CTE names may be unqualified. SELECT INTO, locks, schema changes, modifying CTEs,
stacked statements, session control and arbitrary functions are rejected.

Limits: 32,000 SQL characters, 1–1,000 returned rows (200 by default), 1 MB returned row data (checked in PostgreSQL before transport), a 10-second statement timeout, a 15-second executor deadline,
and four concurrent queries per process. Database connections are separately limited.
A partial result always sets `truncated`; it is not a complete population. Aggregate
in SQL or narrow/paginate queries. Independent calls are not a cross-system snapshot.

Use external connectors for PostHog, Stripe and accounting data that is not present
locally. Existing Stripe/PostHog identifiers are exposed; accounting identity matching
is not inferred from customer names. Historical backfill and missing tracking are
limitations, not zero observations. Report analytical assumptions alongside findings.

## Change staff operations

There are typed `create_admin_<kind>` and `change_admin_<kind>` tools for issues,
tasks, projects, documents, notes, folders, daily notes and rich-text templates.
They expose all supported business properties. Read a record first and pass its
`revision` to changes. Preserve a stable `idempotencyKey` for retries; a changed retry
payload is rejected. Omitted fields are preserved; null clears nullable properties.

Content accepts plain text or native Tiptap JSON. Preserve existing IDs, mentions,
image storage metadata and unsupported nodes when editing surrounding content.
Rich-text `note` mentions refer to documents; `file` mentions refer to topic resource
associations, not raw file records. Document mentions currently link documents only.
Existing file links may be inserted/removed without deleting stored files.

A task may link to an issue or a project, not both. Project leads remain members.
Task estimates are XS–XL sizes, not hours. Tutor visibility is editable and takes
effect immediately. Daily notes are shared per calendar date. Notes on tasks, issues
and projects retain the existing plural target namespaces used by their UI.

Stale revisions and active document editor locks reject agent edits. Re-read and
reconcile; do not overwrite an intervening staff change automatically. Staff UI writes
use the same operations RPC. Each mounted editor retains its first observed revision; unrelated cache refreshes cannot advance that baseline. Its own acknowledged saves advance it, and autosaves are serialized. After a conflict, reopen the editor to accept the current record. This deliberately errs toward rejecting a stale edit. Changes from
other existing database writers also advance revisions through database triggers.
`get_admin_change_history` returns attributed before/after records, including project
membership changes. History is separate from business Lifecycle events.

No tools send messages, change scheduling, mutate payments/HR/forms, upload binaries
or hard-delete records. Completing a task records a status; the agent must actually
complete its underlying work first. Reports and business strategies belong in the
calling conversation or requested artifact destination, not staff procedure documents.

## Verification

The local database contracts live in `supabase/tests/admin_mcp_*_test.sql`. Unit and
HTTP contracts live in admin-web's `features/admin-mcp/server/__tests__`. Runtime
reporting integration tests additionally require a local `ADMIN_REPORTING_DATABASE_URL`
using the dedicated role. The migration's public privilege contract is checked by
`scripts/supabase-migration-privileges.mjs`. Run `pnpm checkall` before shipping.

Local implementation verification: 23 MCP unit/HTTP/editor assertions and six live
reporting cases passed, alongside all 945 database assertions and five critical
browser journeys. Repository lint, type, unit, coverage and Edge Function stages
passed. All production builds passed using an isolated Next.js output directory
after the default shared build output produced a missing `_document` error. The
final admin build also passed. Standards and Spec reviews have no outstanding
findings. Hosted OAuth and production connection configuration remain deployment
smoke checks.
