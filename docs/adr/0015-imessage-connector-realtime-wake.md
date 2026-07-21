# ADR 0015: Hybrid Realtime wake-up for durable iMessage connector

Date: 2026-07-21

## Status

Accepted

## Context

ADR 0014 established a pull connector with atomic claim over `imessage_commands`.
The Mac polled `imessage-connector` about every 2 seconds while idle, which was reliable
but unnecessarily chatty. We needed lower idle request volume without giving up
prompt command delivery or durable queue semantics.

## Decision

- Supabase remains the durable source of truth for commands, claim/complete state, and
  application message state.
- Messages.app / BlueBubbles remains authoritative for provider acceptance and observations.
- Realtime is used only as a **private Database Broadcast wake-up** when a command becomes
  claimable. The payload is `{ "v": 1 }` on topic `imessage:connector:wake` and never
  includes message bodies, recipients, or command contents.
- The Mac obtains a short-lived Auth session via `imessage-connector` action
  `realtime_session` (Bearer `CONNECTOR_SECRET`). The Edge Function provisions a dedicated
  Auth user with `app_metadata.imessage_connector=true` and returns an access token plus
  the publishable anon key. The Mac does **not** use `service_role` for Realtime.
- RLS on `realtime.messages` allows that connector identity to receive broadcasts on the
  wake topic only. That policy is **not** part of CI migrations (`realtime.messages` is
  owned by the Realtime role); apply
  `supabase/manual/imessage_connector_wake_realtime_rls.sql` once via the Dashboard SQL
  Editor after the wake-trigger migration lands.
- The Mac runs a **single-flight** drain loop. Realtime wakes, startup, reconnect, and
  fallback polling all call the same drain. Concurrent wakes coalesce into one follow-up
  drain.
- Fallback polling defaults to ~45s with jitter. Heartbeats remain separate (~30s).
  While a drain finds work, the worker continues claiming until the queue is empty.
- If Realtime is unavailable, fallback polling still claims commands. No commands are lost.

## Consequences

Idle connector traffic drops from roughly one claim+heartbeat every 2s to about one
fallback claim and one heartbeat per configured interval, plus rare wake-driven claims.
Deployment order: migration → Dashboard RLS SQL (once) → Edge Function → Mac bridge
(with `SUPABASE_ANON_KEY`).
Old bridges that still poll every 2s remain compatible during rollout.
Rollback: revert bridge to prior poll loop and/or drop the wake trigger; the durable
queue continues to work on polling alone.
