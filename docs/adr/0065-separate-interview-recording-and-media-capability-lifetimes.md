---
status: accepted
---

# Separate interview recording and media capability lifetimes

For DEV-308, Matthew accepted one continuous recording per Student station encounter on 5 November 2026. Microphone-off, camera-off and pause periods remain silent or blank within that recording. Reading and Exam-mode marking remain excluded; Feedback mode includes verbal feedback. This replaces phase-scoped recording identities while preserving the communication boundaries in ADR 0059.

Keep one bounded provider room and recording identity for the encounter, with separate phase-scoped participant capabilities. Record each capability before minting its provider token. When the phase or pause policy changes, ban retired provider user identities and durably record revocation; ordinary ejection is insufficient because an unexpired token can rejoin. A resumed phase receives a new identity. An AdminStaff observer receives only a station-scoped receive capability and cannot publish media or start recording. Existing durable reconciliation jobs retain responsibility for revocation and room shutdown after failures.

In-person capture uses one encoder and one final immutable audio object. Browser recovery checkpoints may be incremental; they are not separate user-visible recordings. Upload the final object directly to private Storage through an authenticated, capture-scoped signed grant, then validate metadata and finalize attribution. Never grant overwrite of a finalized take. A browser crash can recover its partial take but cannot append a new independently encoded stream without changing the file format; expose that limitation rather than silently corrupting the recording.

Store server-clock question-selection intervals on the station attempt, separately from feedback-based completion. Select Question 1 when question time begins, retain each revisit, and close intervals at pause, station end or the authoritative deadline. Immutable result releases retain their timing evidence. Recording playback aligns intervals with the actual recording start; a question-selection timestamp is not evidence that feedback or assessment is complete.
