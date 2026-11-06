---
status: accepted
---

# Separate interview recording and media capability lifetimes

For DEV-308, Matthew accepted one continuous recording per Student station encounter on 5 November 2026. Microphone-off, camera-off and pause periods remain silent or blank within that recording. Reading and Exam-mode marking remain excluded; Feedback mode includes verbal feedback. This replaces phase-scoped recording identities while preserving the communication boundaries in ADR 0059.

Give each active online call policy a private Daily room with a unique name and a hard deadline. Retire the previous room before issuing credentials for its replacement. A live diagnostic showed that both retired tokens could exchange video in a fresh meeting after an eject-and-ban operation. The provider also returned separate recording files across an empty pause and resume. Durable reconciliation jobs retry room shutdown after failures. AdminStaff observers receive only a station-scoped receive capability.

Keep the recording on the tutor device across call changes. In-person capture uses a microphone track. Online capture uses one canvas video track and one mixed audio track built from the tutor’s authorised call feeds. When media is muted, unavailable, or paused, the same encoder continues with silence or black frames. Browser media support and audio activation are required for online capture.

Use an authenticated signed upload to store one immutable object in private Storage. Validate its metadata and finalise it against the authorised station attempt. Local checkpoints allow recovery of a partial take after a browser interruption. Resuming a partial take would require joining independently encoded streams, so keep the recovered file as the station’s take. Existing provider recordings remain available through the existing playback path.

Store server-clock question-selection intervals on the station attempt, separately from feedback-based completion. Select Question 1 when question time begins, retain each revisit, and close intervals at pause, station end or the authoritative deadline. Immutable result releases retain their timing evidence. Recording playback aligns intervals with the actual recording start; a question-selection timestamp is not evidence that feedback or assessment is complete.
