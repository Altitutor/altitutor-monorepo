# ADR 0015: One global persistent UCAT exam-attempt slot

## Status

Accepted

## Context

Practice sessions, question-set attempts and mock attempts were persisted in
separate tables. Application-level check-then-insert logic could race and allow
more than one resumable attempt, while abandoned untimed attempts remained
resumable forever. Submitting a conflicting partial attempt also produced
misleading scored history.

## Decision

Maintain one database-enforced active slot per student across practice, set and
mock attempts. Completion, confirmed discard, or seven-day inactivity expiry
releases the slot. Discarded and expired attempts retain answers for audit but
are unscored and excluded from attempt history. Timed attempts retain their
server-owned deadline and finalize through the existing deadline catch-up path.

Set and mock quota is consumed by creation of the parent attempt. Practice quota
is consumed when a question is first visible, recorded by `first_seen_at`.

## Consequences

- Concurrent starts cannot create multiple resumable attempts.
- Resume remains the primary conflict action; discard is secondary and always
  confirmed.
- Expiry creates one deduplicated UCAT notification rather than an ephemeral
  expiry notice.
- Terminal audit rows remain available to staff, but cannot be resumed or scored.
