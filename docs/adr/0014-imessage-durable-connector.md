# ADR 0014: Durable iMessage connector

Date: 2026-07-17

## Status

Accepted

## Context

The previous integration pushed requests directly from an Edge Function to an HTTP bridge and
matched callbacks heuristically. A successful HTTP call did not prove that Messages.app accepted
the send, retries could duplicate messages, bridge downtime was exposed to browser requests, and
history sync used an unsafe offset loop.

## Decision

- Supabase is the canonical system of record.
- The dedicated Mac runs a pull connector. It claims durable commands atomically with
  `FOR UPDATE SKIP LOCKED`, executes them locally, and reports a terminal or retryable result.
- Every outbound iMessage row inserted as `QUEUED` creates exactly one `send_message` command in
  the same database transaction. The idempotency key is `send:<message UUID>`.
- All conversations visible to the dedicated Mac are synchronized, including group chats and
  messages sent directly from Messages.app.
- Provider GUID is authoritative. The command UUID is also sent as `tempGuid`/correlation so an
  outbound callback can reconcile without body/time heuristics.
- A send with uncertain provider acceptance becomes `AMBIGUOUS` and is not retried automatically.
- Connector endpoints use a server-only `CONNECTOR_SECRET`; browsers never receive it.
- Administrative controls use the caller's JWT and an audited `SECURITY DEFINER` enqueue RPC.
  Destructive commands require active `ADMINSTAFF`, a non-empty reason, and staff attribution.
- Staff inbox read state remains in `conversation_reads`. `mark_chat_read` and
  `mark_chat_unread` are explicit commands to Messages.app and do not mutate staff read state.

## Consequences

The connector can be offline without losing commands. Command history and sanitized heartbeat
state are inspectable by admin staff. Operations that cannot safely distinguish success from
failure require manual reconciliation. The legacy history endpoint is retired; history is replayed
as idempotent `reconciliation-message` events.

The RPCs are exposed in `public` because Edge Functions call them through PostgREST. Their execute
privileges are narrowly granted, they use an empty `search_path`, and service-only functions verify
the JWT database role in addition to RLS and grants.
