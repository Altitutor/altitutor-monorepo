# ADR 0020: Parameterless UCAT active-attempt experience

## Status

Accepted

## Context

Practice, set, and mock attempts used separate engine routes even though the student may have only one active UCAT exam attempt. This duplicated route-specific shell behaviour and made the route identify both the engine mode and the active attempt.

## Decision

Use parameterless `/exam` as the single fullscreen experience for the student's active Practice session, set attempt, or mock attempt. Launch actions complete tutorial, access, and quota preflight before creating or resuming an attempt; `/exam` then resolves that server-owned active attempt. Mode-specific engine routes are removed rather than retained as compatibility adapters. `/exam/tutorial` remains separate because the tutorial is not an attempt, and embedded lesson or session-assigned stem activities remain in their parent pages.

## Consequences

- Refresh and resume depend on the durable global active-attempt slot rather than URL mode or client session storage.
- Attempt launch must succeed before navigation to `/exam`.
- One shared fullscreen shell owns the optional top or right toolbar, while mode adapters supply their valid title, controls, and statistics.
- Results retain their dedicated progress routes.
