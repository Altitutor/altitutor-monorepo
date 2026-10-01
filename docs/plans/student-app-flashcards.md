# Student app flashcards

Status: implemented. Native device smoke testing remains pending.

## Objective

Bring the StudentWeb flashcard study experience into native StudentApp screens while keeping one authoritative schedule across web and app. Study requires a network connection at launch. This plan follows [ADR 0049](../adr/0049-centralize-flashcard-scheduling.md); it does not introduce a device scheduler or a sync service.

## Student experience

- Open the Flashcards hub from its bottom tab. It shows the due count, Study all, Subject study choices, Manage, and a link to Flashcard settings. Due study opens outside the tabs, with review controls fixed at the bottom and bury and refresh icons in the header.
- Add Topic flashcards to each applicable Resource topic. Free flashcard study runs through every review card in that Topic without changing its schedule; the Topic also links to its filtered Due review.
- Render text cloze and image occlusion cards, answer-side context, embedded images, rating previews, and notes and solutions links. A Flashcard with multiple clozes presents each Flashcard review card separately.
- Due review supports Again, Hard, Good, Easy, undo of the last committed answer, bury, and the web's leech suggestion. The session respects the server's New, Learning, Relearning, and Review ordering, Student-wide daily allowance, sibling burying, and study-day boundary.
- Provide a native card manager with search, state and status filters, cloze previews, and forget, suspend, resume, bury, unbury, and unbury-all actions. Do not show review history in the app.
- Open `/settings/flashcards` on StudentWeb through the app's signed browser handoff. Extend its destination allowlist, which currently permits only `/settings/profile`.

## Data and authority

- Reuse the StudentWeb flashcard snapshot and command handlers. The app sends its Supabase bearer session to those API routes; the routes must accept both the existing web cookie and a verified bearer token through one student-scoped auth helper. When a bearer token is supplied, authenticate and authorize that token's Student rather than falling back to an unrelated browser cookie. Preserve `vstudent_*` reads, server authorization, and atomic database commands. The app receives no service-role credentials and writes no base tables.
- Keep the scheduling algorithm, preset resolution, limits, timezone rules, revision checks, idempotency, and review history on the server. A rating is considered saved only after the server confirms it. Keep a failed command's request ID for safe retry when its outcome is unknown.
- Extend the authenticated route path for flashcard image URL refresh. Signed URLs can expire during an open study screen, so the app refreshes them as needed.
- Use existing Resource file IDs in note and solution links to open the corresponding native Resource viewer when available.
- Keep flashcard data in the current in-memory query cache only. Do not persist a card catalog, answer outbox, or local scheduling state. Without connectivity, show a retryable unavailable state and block study commands.

## Interruption and conflicts

- After backgrounding or reopening the app, fetch a fresh Due snapshot. Committed answers remain reflected by the server; an unsaved card can appear again. Restart an unfinished Free study pass when its Topic screen is reopened.
- Within an open Due session, hold a successfully answered card until its scheduled time and a newer revision are visible. The server's learn-ahead snapshot may contain that card immediately after the answer, so selecting the first snapshot card would repeat it too early.
- Show the next card immediately when a rating is tapped, while keeping the rating pending until the server confirms it. Restore the rated card and its answer if the command fails.
- On a stale revision or other cross-device command conflict, restore the card, explain that the answer was not saved, and refresh the authoritative queue. Do not apply the old rating to the changed card automatically.
- On a transient failure with an unknown outcome, retain the exact idempotent command for retry. If the server reports that the command expired or conflicts, refresh instead of replaying it as a new answer.
- Send bulk management actions such as unbury-all in a controlled sequence so the server's Student-level command lock does not turn concurrent requests into partial, unexplained failures.
- Clear or partition cached flashcard queries when the signed-in Student changes or signs out, so one Student cannot see another Student's in-memory study data.

## Implementation sequence

1. Add a shared StudentWeb flashcard API authentication boundary for cookie and bearer callers, with route tests for both identities, unauthorized access, and Student-scoped visibility. Apply it to topic, snapshot, rating, undo, management, and image URL routes.
2. Add a StudentApp flashcard API adapter and query hooks using the shared flashcard DTOs. Model command pending, confirmed, failed, and conflict states without a local scheduler.
3. Build the Flashcards tab, full-screen Due session, Topic Free study entry, image/cloze presentation, and native manager. Integrate native Resource links and the settings browser handoff.
4. Verify web and app against the same account: answer and undo, subject and Topic filters, daily limits, short learning steps, sibling burying, leech prompt, card management, image refresh, app interruption, loss of connectivity, sign-out, and simultaneous study on two devices.

## Boundaries

- No offline study, durable sync queue, local FSRS computation, or review-history screen in StudentApp.
- No flashcard schema migration is expected. Any later offline Due review proposal must revisit the server's five-minute command window, revision conflicts, global daily allowances, and cross-device ordering before introducing a sync protocol.
- Existing uncommitted StudentApp work is present in this checkout; implementation should preserve it and verify current navigation and auth files before editing.
