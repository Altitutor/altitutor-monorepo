---
status: accepted
---

# Make stations the reusable interview content

Matthew clarified on 23 October 2026 that MMI stations comprise a shared prompt and linked questions that cannot be mixed between stations. Stations own their prompt, exactly one category and score maximum; questions own multiple tags, rubric, recommended timing and feedback. Matthew accepted the design and implementation on the same day, including live rubric editing with revision notices and duplicate whole-station placements with warnings, tracked in [DEV-226](https://linear.app/altitutor/issue/DEV-226/make-stations-the-reusable-unit-of-medicine-interviews), following DEV-8.

Make the station the bank item and authoring unit, retaining ordered questions as owned children with stable identities. Use relational station and child-question authoring records saved through station-scoped commands; remove standalone question-bank editing and cross-station question selection. Interviews reference whole stations through ordered placements with their own occurrence identities. This preserves question-specific rubrics, timing and feedback without making questions independently reusable; collapsing a station into one text field would lose that structure.

Retain one station attempt per student and station occurrence, with one score and question-specific feedback. The existing interview attempt already has this shape, so no separate question-attempt entity is needed. Preserve attempt identities, recording links, assessment concurrency and immutable result releases rather than rewriting the round lifecycle as part of the authoring refactor.

This replaces ADR 0057's prepared bank-question references with whole-station references while retaining its preservation policy: shared content updates prepared interviews, prompt/question wording freezes when a round starts, and rubric corrections can reach active rounds with revision history and notices. Snapshot question identities, order, recommended timing and the station maximum so later content edits cannot reinterpret earlier feedback or scores. Per-question recommended timing remains tutor guidance within the coordinated round clock. Repeated whole stations retain independent occurrence and assessment identities; recommended question timing does not change the shared enforced clock.

DEV-8's interview migrations have already reached development according to its latest delivery evidence. Implement this refactor with a new forward migration and the owned disposable database verification workflow; the feature's pre-production status does not make applied migration files editable or authorize ad-hoc remote database writes.
