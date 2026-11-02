# Separate shared mailbox state from thread responsibility

The Shared admin mailbox remains one Exchange mailbox operated through both admin-web and Outlook, with read state, folder changes and replies reflected across clients. Altitutor owns separate Email thread responsibility: reads preserve it, incoming follow-ups before a staff reply retain and notify the assignee, and any staff reply clears it; later incoming mail is unassigned. This avoids using a read flag as proof that an operational request has been handled.

Email context links attach uniquely matched direct participants to their own Student/Parent records; child context requires an explicit link rather than household roll-up. Routine replies use the common Altitutor Admin sender with the real replying staff member's signature. Core operational emails belong in shared Sent and directly relevant Activity while retaining canonical message builders and business eligibility; identity/security and UCAT campaign workflows remain separately owned. Provider state, staff responsibility and business correspondence projections therefore have distinct ownership, rather than being inferred from one another.

These decisions were confirmed by Matthew during DEV-250 discovery on 28 October 2026. They do not modify the concurrently owned DEV-151 implementation; parity must be reconciled against its eventual delivered behavior separately.


## Environment isolation (DEV-250 follow-up, 2026-10-30)

One mailbox is shared by all active portal administrators in each environment:
production `admin@altitutor.com`, development/preview `admin@development.altitutor.com`.
Microsoft application credentials, mailbox-scoped Exchange roles and database
provider state are separate. Vercel deployment metadata selects the mailbox;
Edge Functions require explicit `EMAIL_ENVIRONMENT`. `NODE_ENV` cannot distinguish
preview from production and is not used. Legacy onboarding credential fallback
is removed to avoid accidentally connecting development to the production mailbox.

The database stores an immutable singleton mailbox identity. Legacy provider state
is production-owned; the first development connection must use an empty dedicated
provider cache. Each sync/observation and operational-send preparation asserts the
binding transactionally. Old RPC callers default to production, so they fail against
a development-bound database instead of mixing IDs. Existing mail is preserved on
mismatch. No automated cleanup or reinterpretation is permitted.

Development uses an exact application recipient allowlist including To/Cc/Bcc and
a separate Exchange external-recipient restriction for Outlook. Operational senders
retain their existing delivery identities/content; only the environment sender and
reply address change. Authentication and UCAT campaign transports remain separate.
See [the setup runbook](../agents/admin-mailbox-setup.md).
