# Altitutor domain glossary

## Tutor timetable

- **Calendar subscription** — A tutor-owned, read-only calendar feed containing that tutor's active assigned sessions. Calendar providers poll the subscription so session additions, changes, and cancellations flow through without tutors importing events again.
  _Avoid_: Calendar export, calendar sync, shared calendar

## Public web surfaces

- **Marketing site** — The public, search-indexable website served from `altitutor.com`. It presents Altitutor's courses, resources, company information, and acquisition pages; it does not own authenticated learning, booking, checkout, or account workflows.
  _Avoid_: Main site, WordPress site, landing pages

- **Product app** — A user-facing application that owns an authenticated or transactional product workflow, such as the student portal or UCAT practice app. Product apps may have public entry pages, but their product workflows are separate from the Marketing site.
  _Avoid_: Landing site, marketing app

## Subject resources

- **Form** — A staff-defined set of questions that can collect structured responses from students, staff, parents, or public respondents. A form may be used for surveys, feedback, check-ins, unenrolment, discontinuation, or unsubscribe flows; those are form purposes, not separate product concepts.
  _Avoid_: Survey, questionnaire

- **Form response** — One submitted answer set for a specific form version. The respondent and the subject of the response may be different people, such as a parent submitting a response about a student; a response may optionally be linked to one session when collected during that session.
  _Avoid_: Survey result, submission

- **Student exit request** — A one-time, staff-initiated request for an authenticated student to submit a form before a scheduled unenrolment or discontinuation. It identifies the student and their final session dates, and becomes inactive when staff resolve the exit manually or the request is no longer applicable.
  _Avoid_: Form response, public form link, unenrolment form

- **Form respondent** — The person or anonymous actor who completes and submits a form response. The respondent may be a student, staff member, parent, public contact, or anonymous visitor.
  _Avoid_: User, participant, submitter

- **Form subject** — The person or operational object that a form response is about. The subject may be the same as the respondent, a different person, or absent for general feedback.
  _Avoid_: Target, related record, entity

- **Form version** — An immutable published definition of a form's questions, options, validation, and conditional display rules. Form responses always belong to the version that was answered; editing a published form creates a new draft or published version rather than changing historical response meaning.
  _Avoid_: Current form JSON, editable published form

- **Form block** — One ordered item in a form version. A block may be an answerable question or non-answering content such as explanatory text with optional link buttons.
  _Avoid_: Page, section, survey element

- **Public form link** — An unguessable link that lets a respondent open a published form without first signing in. Public form links still belong to a form version and may collect respondent contact details when the form requires them.
  _Avoid_: Survey link, public survey, anonymous form URL

- **Form route** — The respondent-facing route for opening and answering a form. Use `/form`, not `/survey`, even when the form's purpose is feedback collection.
  _Avoid_: Survey route, survey page

- **Feedback** — The operational area where staff review form responses, form reports, and check-in recency. Feedback is for interpreting people-facing responses and follow-up signals, not for defining the forms themselves.
  _Avoid_: People, relationships, HR, survey dashboard

- **Topic** — A node in a subject's resource tree. Topics group student-facing resources for that subject and may contain child topics.
  _Avoid_: Learning module, UCAT module

- **Topic resource** — A student-facing study item attached to one topic, such as a file or topic flashcards. Topic resources belong to the general student resource experience, not the UCAT Learn catalog.
  _Avoid_: Learning module block, lesson content

- **Topic flashcards** — The ordered cloze flashcards attached directly to one topic. The topic itself is the collection boundary students open from Resources.
  _Avoid_: Deck, learning module, file, flashcard collection

- **Flashcard** — One cloze-deletion study prompt attached to a topic. Flashcards use cloze markers in the prompt itself and do not have separate front/back sides.
  _Avoid_: Basic card, note, question

- **Flashcard review card** — One reviewable cloze marker generated from a flashcard. A flashcard with multiple cloze markers creates one review card per marker, and each review card has its own spaced-repetition state.
  _Avoid_: Flashcard side, front/back card, note

- **Due flashcard review** — A student study mode that shows only flashcard review cards whose spaced-repetition state is due. Student ratings update the review card's next due date and scheduling state.
  _Avoid_: Quizlet mode, browse mode

- **Free flashcard study** — A student study mode that shows all flashcard review cards in a selected topic without changing spaced-repetition state.
  _Avoid_: Due review, scheduled review

- **Anki flashcard import** — A staff workflow for bringing existing Anki cloze material into a topic from a text export such as CSV. The import accepts cloze cards only; front/back cards and `.apkg` package parsing are not part of the first flashcard import scope.
  _Avoid_: Mobile sync, push reminder setup, basic-card import

- **Flashcard import row** — One row in an Anki flashcard import. The row must provide cloze text and may provide a title, order, and extra answer-side context.
  _Avoid_: Anki note model, front/back row

## UCAT content

- **UCAT content rating** — A student's thumbs-up or thumbs-down evaluation of one displayed UCAT insight or answer explanation, optionally accompanied by a reason. The rating stores the displayed content and its context so later wording revisions remain distinguishable. _Avoid_: feedback, survey response, content vote

- **UCAT mock exam** — A complete practice exam made of UCAT section content that students can attempt as an exam-like experience.

- **UCAT exam attempt start** — The moment a student confirms **Ready to Begin** and enters the first timed or untimed exam segment (instructions or questions). This is when a set attempt, mock attempt, or practice session is considered started for quota, progress, and resume — not when they open the launch screen and not when they submit their first answer. Instructions time (when configured) is part of the attempt from this point.
  _Avoid_: Launch click, first answer, session created

- **Incomplete UCAT exam attempt** — A started set attempt, mock attempt, or practice session that is still eligible to resume. It remains incomplete until the student submits, a timed attempt is finalized by its server deadline, the student discards it, or an untimed attempt expires seven days after its last activity.
  _Avoid_: Unsubmitted answers, draft session

- **Expired UCAT exam attempt** — An untimed incomplete set attempt, mock attempt, or practice session whose last activity was more than seven days ago. Expiry frees the student's in-progress slot and preserves the attempt for audit, but does not score it or place it in completed history.
  _Avoid_: Timed expiry, automatic submission, completed attempt

- **Discarded UCAT exam attempt** — An incomplete set attempt, mock attempt, or practice session that the student explicitly ends without submitting for a score. Discard preserves the attempt and answers for audit, frees the in-progress slot, and never places the attempt in completed history.
  _Avoid_: Delete attempt, submit partial attempt, scored attempt

- **UCAT exam timing segment** — One timed or untimed portion of an exam attempt with its own rules and optional server countdown. Examples: set instructions, set questions, one mock set’s instructions, one mock set’s questions, one practice question unit (single question or whole stem). Timed segments store a server `ends_at` while active; untimed segments have no countdown. The server clock applies to the **current segment only**, not the whole mock or practice session in one lump.
  _Avoid_: Whole-exam timer, session timeout

- **UCAT question active time** — The time attributed to a question while it is current and the UCAT question engine is visible. It pauses when the page is hidden, disconnected, or leaves the question segment, then resumes from the accumulated value when the student returns; a timed exam segment's server countdown continues independently while the student is away.
  _Avoid_: Wall-clock session time, background time, dwell time

- **In-progress UCAT exam attempt limit** — A student may have at most one incomplete set attempt, mock attempt, or practice session at a time (across all three). Starting a different set, mock, or practice while one is incomplete opens a blocking dialog: **resume** the current attempt, or **discard** it unscored and then start the new one. Same one-at-a-time rule as skill trainer attempts, but scoped to exam-style activities (sets, mocks, practice) as a group.
  _Avoid_: Multiple drafts, parallel mocks

- **UCAT exam attempt finalization** — Closing out an incomplete attempt as a scored result by setting `completed_at` and scoring all questions with current answers (unanswered = 0). Applies to explicit submit and timed-attempt deadline expiry; expiration and discard are unscored terminal outcomes and do not appear in completed history.
  _Avoid_: Abandon without record, discard draft

- **UCAT exam segment catch-up** — When a student returns after being away, the server replays any timing segments whose `ends_at` has already passed: each expired segment is finalized the same way as in-session time expiry (unanswered in that segment score 0; mocks advance to the next segment). Catch-up runs until the current segment still has time remaining or the whole attempt is complete. The student then resumes at that computed position.
  _Avoid_: Pause timer, single-segment-only expiry

- **UCAT exam attempt resume snapshot** — Server-persisted JSON of question-engine state for an incomplete attempt: phase, segment position, question index, visited and flagged questions, selected answers, syllogism snapshots, practice-specific position, and current segment `ends_at` when timed. Updated as the student works so reload, new device, or explicit resume restores the same screen. Answer rows in `student_question_attempts` are kept in sync for scoring; the snapshot is the source of truth for UI position.
  _Avoid_: Session storage only, client-only state

- **Practice session** — One student run of practice mode (fixed stem batch or unlimited stems) tied to a `student_practice_sessions` row. Stays **incomplete** until the student taps **Done**, discards it, or it expires after seven days without activity. Submitting individual stems, including when a timed practice stem expires, records answers and shows feedback for that stem but does not complete the session; the student may continue or resume the same session across visits while it remains incomplete.

- **Practice review timing** — The student's choice to see feedback after each question stem or only after the practice session is submitted. Review-at-end practice does not use the question engine's pre-submission review screen; finishing submits the entered stems and opens the completed practice-attempt page.
  _Avoid_: Practice mode, set mode
  _Avoid_: Per-stem session, practice attempt per question

- **UCAT Free quota reset entitlement** — A student-held entitlement that a student may explicitly use before its expiry date to make all UCAT Free quota areas count usage from the reset moment rather than from the normal quota-period start. The expiry date lasts until the end of that calendar day in the student's timezone. A student may hold multiple reset entitlements; when they use one, the entitlement expiring soonest is consumed first. It is visible with the student's Free quota status even before they hit a quota wall, is never used silently, and does not delete exam, practice, learn, or trainer history.
  _Avoid_: Admin reset, quota deletion, free quota override

- **Admin UCAT quota reset** — A staff-only corrective action that immediately resets a selected student's current UCAT Free quota usage for one quota area. It is an operational adjustment tool, not a student-held entitlement and not a Pro access grant.
  _Avoid_: Quota reset entitlement, Force Pro, manual online access

- **In-progress exam attempt resume (UX)** — While a student has an incomplete set, mock, or practice session, show a **persistent site-wide banner** whose primary action resumes the attempt and whose secondary action discards it after confirmation. No separate “In progress” section on progress pages — history lists **completed** attempts only. **Auto-resume:** opening the same set or mock they already started (e.g. Launch set / Start mock for that id) goes straight into that attempt instead of starting over. Opening a _different_ set, mock, or practice shows one resume-or-discard dialog that includes the discard warning without opening a second confirmation. Practice has no stable content id like a set; resume is via the banner (or returning to `/practice/session` for the active session), not by starting a new filtered batch.
  _Avoid_: In progress tab, session storage resume

- **UCAT exam attempt lifecycle (scope)** — The hardened attempt model (start at Ready to Begin, server segment clock, resume snapshot, one in-progress slot, site banner, finalization rules) applies to **sets**, **mocks**, and **practice** only. Session-linked sets and mocks follow the same rules. **Learn** lesson question blocks and **skill trainer** are out of scope for this shared in-progress slot; skill trainer keeps its own attempt rules.
  _Avoid_: Lesson practice as full exam, global attempt for drills

- **Mock set attempt** — For each set within a UCAT mock, a `student_question_set_attempts` row is created when the mock **enters that set’s first timing segment** (instructions if configured, otherwise questions). Not at mock launch screen, not on first answer. Linked to the parent mock attempt. Holds per-set question attempts for scoring when that set’s segments end or the mock is finalized.
  _Avoid_: Lazy set attempt on first answer, all sets upfront at intro

- **In-progress question attempt sync** — During an incomplete set, mock, or practice session, each answer selection and flag toggle is upserted to `student_question_attempts` promptly (debounced), with `is_submitted: false` until attempt finalization. The resume snapshot and question rows are kept aligned so partial work survives reload and device changes.
  _Avoid_: Answers only on submit, snapshot-only persistence

- **UCAT section** — One of the canonical UCAT areas, such as Verbal Reasoning, Decision Making, Quantitative Reasoning, or Situational Judgement.

- **Learning module** — A node in the UCAT Learn catalog tree. Two mutually exclusive kinds: **folder** (organizes child modules) or **lesson** (delivers ordered content blocks). A module is exactly one kind — never both. May optionally belong to one UCAT section for grouping on `/learn`. Tutors manage the catalog in tutor-web; students browse the tree on `/learn` and open lessons at `/learn/{id}`.
  _Avoid_: Course, topic, unit

- **Learning module folder** — A learning module that contains only child learning modules in display order. Has no content blocks. Completion progress is derived from its descendants. Browsing or expanding folders does not consume UCAT Free learn quota.
  _Avoid_: Category, module group, container node

- **Learning module lesson** — A learning module that contains only ordered content blocks. Has no child modules. The student lesson view (`/learn/{id}`) applies to lessons only. First open of a never-before-viewed lesson in the current quota period consumes one UCAT Free learn quota unit; returning to any previously viewed lesson does not consume future learn quota. Tutors configure **lesson display mode** per lesson: **scroll** (all blocks on one page with TOC anchor jumps) or **stepped** (one block at a time with previous/next navigation). Gating (`require_completion_before_next`) applies in both modes — in scroll mode, TOC jumps to a block are blocked until prior gated blocks are complete.
  _Avoid_: Learning unit, module page, lesson node

- **Learning module lesson display mode** — Tutor-authored setting on each lesson. **Scroll:** all blocks visible on one scrollable page; table of contents jumps to in-page anchors. **Stepped:** one block visible at a time; footer previous/next moves between blocks. Default for new lessons: stepped.
  _Avoid_: View mode, layout toggle

- **Learning module block** — One ordered content unit within a learning module lesson. Stored in a dedicated blocks table (not inline JSONB on the lesson). Types: rich text, video, file, question stem, single question, or skill trainer. Images are embedded in rich text blocks only — there is no separate image block type. Video blocks store an external embed URL (YouTube, Vimeo, Loom, etc.) in block `content` — no uploaded video storage in v1. Each block has display order, an optional `require_completion_before_next` gate (default on), and typed foreign keys where the content references existing UCAT entities (stems, questions, files, skill trainer types). Simple payloads (e.g. rich text body, video URL) may live in a small JSONB `content` column on the block row. Tutors may attach either a whole question stem or a single question per block — both block types are supported.
  _Avoid_: Lesson section, content chunk, block JSON

  _Avoid_: Trainer playlist, drill set

- **Learning module video block** — Embeds an external video URL (YouTube, Vimeo, Loom, etc.) stored in block `content`. Block completion when at least 50% has been watched.
  _Avoid_: Uploaded video, media block

- **Learning module skill trainer block** — A learning module block that references one skill trainer type. The student runs a timed embedded skill trainer session using a random queue from approved active items in that trainer's bank. Block completion when that learn-context session completes (time expiry or current run finished). Does not consume UCAT Free skill-trainer quota — only the parent lesson's learn quota applies.
  _Avoid_: Embedded trainer game, inline drill

- **Learning module question block** — A learning module block that embeds UCAT assessment content for students. **Stem block:** references a question stem; the student works through all questions on that stem. **Question block:** references one question on a stem; stem context is shown when the question belongs to a stem. Student-facing lessons may only resolve published assessment content (an accessible lesson may grant access to referenced private published content without placing it in the public question pool). Answers submitted from learn blocks do not consume UCAT Free practice quota.
  _Avoid_: Practice embed, inline quiz

- **Pending generated assessment placeholder** — A tutor-only learning-module stem or question block that reserves a slot for an AI-generated question stem still in the normal generation and approval workflow. Allowed only on unpublished lessons (draft or in review); never student-visible. May be saved before stem/question IDs exist, keyed by the generation run; the lesson editor polls that run, links IDs when ready, and keeps the block pending until the stem is published. A question-block placeholder still comes from a generated stem and binds to one question on that stem (typically the first). Once the stem is published, it becomes an ordinary learning module question block referencing that content. Publishing a lesson that still has pending placeholders is blocked. A stem embedded only in unpublished lessons may still move between draft and in review; only **published** lesson embeddings (or session links) block withdrawing that stem from student-safe status.
  _Avoid_: Lesson-only question, embedded draft stem, unpublished student content, orphan generated question, private-lesson-only placeholder

- **Learning module block completion** — Per-block progress tracked for the student. **Text:** scrolled to the bottom. **Video:** at least 50% watched. **File:** embedded viewer (iframe / PDF) entered the viewport, or the download/open link was clicked. **Question stem:** every question on the stem has a submitted answer. **Question:** that question has a submitted answer. A student may manually mark an individual block complete (override). Lesson completion is derived only from block completion — there is no separate lesson flag independent of blocks.
  _Avoid_: Section done, step finished

- **Learning module lesson completion** — A lesson is complete when every block in that lesson is complete (including manually marked blocks). The lesson-level **Mark as complete** control marks all blocks in that lesson complete at once; it does not maintain a separate completion state.
  _Avoid_: Course finished, module done flag

- **Learning module folder progress** — Completion percentage for a folder is rolled up from its descendant lessons and folders (child module completion feeds parent display progress on `/learn`).
  _Avoid_: Category progress, folder checkmark

- **Learning module progress** — Per-student progress on the Learn catalog. **Module progress row:** one per `(student, learning module)` — records `started_at` (first lesson open; consumes learn quota when applicable), cached completion percentage, and timestamps. **Block progress row:** one per `(student, learning module block)` — records block completion, manual override, and type-specific interaction state (e.g. video watch percentage). Lesson completion is derived from block rows; folder completion rolls up from descendant module rows. Block rows are created lazily as the student interacts.
  _Avoid_: Lesson attempt, course enrollment

- **Session-linked learning module** — A **published** learning module lesson attached to a class session via `ucat_sessions_resources` (alongside sets, mocks, and question stems). Only **lessons** may be session-linked — folders are catalog structure only. Unpublished lessons cannot be attached. Students on that session's class roster may open the linked lesson from the session view; access follows the same session-scoping pattern as session-linked question stems. Session links also block withdrawing or soft-deleting the lesson until removed.
  _Avoid_: Session course, assigned module folder

- **Learning module lesson visibility** — A lesson uses the shared **UCAT content status** and **UCAT content access scope**. Only **published** lessons can be student-accessible. A **published public** lesson appears on `/learn` for students with Learn access. A **published private** lesson is excluded from the global catalog but remains openable when session-linked for rostered students. Draft and in-review lessons are tutor-only and are not student-accessible even if session-linked. Folders have no independent student visibility rule beyond containing accessible descendant lessons; `deleted_at` retires a module entirely.
  _Avoid_: is_private, published flag, is_active, catalog toggle, folder lifecycle

- **Skill trainer** — A gamified, timed UCAT drill that targets one narrow skill (e.g. speed reading, mental maths). Separate from exam questions, sets, mocks, and practice — own catalog, content bank, scoring rules, and attempt history. A student picks a trainer type, plays for a configured time limit, and earns a score. Optional passage text may be imported from an existing question stem when authoring VR items; skill trainer play does not count as practice or exam attempts.
  _Avoid_: Mini practice, drill mode, skill game

- **Skill trainer type** — One of six fixed catalog entries (Find the word, Find the concept, Quick syllogisms, Mental maths, Numpad speed, Calculator maths speed). Each belongs to one UCAT section and has admin-configurable timing and scoring. The catalog is seeded in the database; admin may enable or disable a type but cannot add new types without a code release.
  _Avoid_: Skill trainer game, exercise mode

- **Skill trainer item** — One unit of drill content within a skill trainer type (e.g. one VR passage with keywords and hit targets, one maths question, one calculator button sequence). Authored for the skill trainer bank only; not an exam question stem.
  _Avoid_: Trainer question, drill stem

- **Skill trainer config** — Admin-editable timing and scoring rules for one skill trainer type (time limit, base points, wrong-answer penalty, streak rules, speed bonus window/max points). Snapshotted when an attempt starts. Interaction tolerances (e.g. hitbox padding around a target sentence) and formulaic scoring for item complexity (mental maths difficulty, numpad sequence length) are computed in application code, not admin settings.
  _Avoid_: Trainer settings, game config

- **Skill trainer target** — A correct interaction location within a skill trainer item (e.g. the sentence containing a keyword, or one occurrence of a concept in a passage). Stored as authored metadata on the item; click/drag tolerance padding is a fixed UI constant, not configurable per trainer. Find the word: target sentence index within the passage. Find the concept: character offsets (plain text) per occurrence.
  _Avoid_: Hitbox config, hotspot setting

- **Skill trainer item bank** — The set of active skill trainer items for one trainer type. Items are stored in a single bank per type with a JSONB content payload validated per trainer key; VR items may optionally reference a source question stem for imported passage text only.
  _Avoid_: Trainer question pool, drill database

- **Skill trainer item authoring** — Tutors create and edit skill trainer items in tutor-web (list + detail routes, similar to the UCAT questions workflow). Admin-web configures trainer-level timing and scoring only, not individual item content.
  _Avoid_: Trainer content admin, drill CMS

- **Skill trainer item approval** — Skill trainer items follow the same approval workflow as question stems: `approved`, `pending`, or `rejected`. New tutor-authored items default to pending. Only approved and active items are included in the student item bank. Admin staff may approve, reject, or deactivate items; tutors author and edit.
  _Avoid_: Trainer publish, content review queue

- **Skill trainer attempt** — One student play-through of a single skill trainer type from start to finish (or time expiry). Consumes one UCAT Free skill-trainer quota unit when started. Produces one score used for personal history and leaderboards. The timer is fixed at start (`ends_at = started_at + time limit`) and keeps running if the student leaves and returns — resuming the same in-progress attempt does not consume another quota unit. A student may have at most one in-progress skill trainer attempt at a time, across all trainer types.
  _Avoid_: Trainer session, drill run

- **Skill trainer attempt resume** — Returning to an in-progress skill trainer attempt continues the same timed run with the remaining time on the server clock. Abandoned attempts are not auto-completed; they remain in progress until time expires or the student finishes. Starting a different trainer type while one is in progress is blocked until the current attempt ends or expires.
  _Avoid_: Attempt restart, new run

- **Skill trainer attempt expiry** — When the server clock reaches `ends_at`, the attempt is finalized lazily on the next skill-trainer API call: `completed_at` is set to `ends_at`, in-progress item state is cleared, and the score becomes eligible for leaderboards. No background cron is required.
  _Avoid_: Timer job, session timeout worker

- **Skill trainer attempt item** — One skill trainer item completed within an attempt (e.g. one passage finished, one maths question answered). Records score delta and a result summary; used for analytics and score audit. In-progress partial state for the current item lives on the parent attempt, not as an attempt item row until complete.
  _Avoid_: Round, trainer question attempt

- **Skill trainer item queue** — The ordered list of items presented during one attempt. Built at attempt start by shuffling the active item bank; when exhausted, reshuffled and continued until time expires. The same item is not shown twice in a row when the bank has more than one item. Queue state is persisted on the attempt for resume.
  _Avoid_: Item playlist, drill order

- **Skill trainer leaderboard** — A ranked list of students by best attempt score for one skill trainer type within a time window. One board per trainer type (not global across types). Windows: this week (ISO week, student timezone) and all time. Only completed attempts count. Ties broken by earlier achievement.
  _Avoid_: High scores table, global ranking

- **Question stem** — The shared prompt, passage, scenario, table, image, or setup that one or more UCAT questions refer to.

- **Question catalog search** — Tutor-facing, case-insensitive literal substring matching across one or more tutor-selected question-content scopes: question stem text, question text, answer-option text, and tutor source note. It is not relevance-ranked, semantic, or whole-word-only search.
  _Avoid_: Relevance search, semantic search, full-text search

- **Question catalog projection** — An internal, synchronously maintained, one-row-per-stem read model containing the searchable text and summary metadata required to query the tutor question catalog efficiently. Its first consumer is the tutor question catalog; other workflows may reuse the read model only when they need the same stem-level query shape, without sharing the catalog endpoint or tutor-specific interface.
  _Avoid_: Question cache, student question view, shared question endpoint

- **Question progress point** — One unit toward a student's "questions completed / total questions" progress ratio. Each non-syllogism question contributes one point. A syllogism stem contributes two points total, regardless of how many conclusion statements it contains. Soft-deleted questions are excluded from both completed and total counts.
  _Avoid_: Stem point, question attempt count

- **Accessible question bank** — The set of non-deleted questions on published question stems that the student may access, either publicly or through an explicit learning-module or session link. It defines the denominator for the student's UCAT progress totals.
  _Avoid_: All published questions, tutor question list, stem catalog

- **UCAT content status** — The authoring lifecycle shared by question stems, question sets, mock exams, and learning module **lessons**: **draft**, **in review**, or **published**. Draft and in-review content is tutor-only. Published content may be student-accessible according to its access scope. AI generation creates question stems in review; tutor authoring creates drafts. Published content may be edited in place, and may be moved back to in review or draft to withdraw it from student access. Learning module **folders** do not use this lifecycle — they are catalog structure only.
  _Avoid_: Approval status, visibility, active status, folder lifecycle

- **UCAT content access scope** — The access rule for published question stems, question sets, mock exams, and learning module **lessons**: **public** content may appear in the relevant student pool or Learn catalog, while **private** content is accessible only through an explicit learning-module or session link. Access scope has no student-facing effect until the content is published. A public parent cannot contain a private child. Learning module **folders** do not use access scope for student visibility; a folder appears when it has at least one accessible descendant lesson.
  _Avoid_: Publication status, approval, visibility

- **UCAT authoring MCP** — The remote, Supabase OAuth-authenticated Codex interface for reading UCAT authoring content and creating or editing draft/in-review learning module lessons, question-stem bundles, sets, and mocks. It is an additional authoring client alongside tutor-web, cannot publish or mutate published/top-level-deleted content, and attributes every mutation to the acting UCAT tutor.
  _Avoid_: Tutor-web replacement, service-role authoring API, autonomous publisher

- **UCAT authoring revision** — An opaque concurrency token returned with every MCP aggregate read and required by MCP updates or review submissions. The database checks it while holding the aggregate lock and rejects stale writes, requiring Codex to re-read and reconcile.
  _Avoid_: Content version, publication revision, updated-at timestamp

- **Deleted UCAT content** — A soft-deleted question stem, question set, mock exam, or learning module **lesson**. Deleted content is hidden from students and normal tutor lists and appears in the tutor Deleted view. Restoring deleted content always returns it to draft. Learning module folders may also be soft-deleted as catalog structure, but they do not participate in the content status lifecycle.
  _Avoid_: Archived content, unpublished content

- **UCAT publication readiness** — The hard validation required before a question stem, set, mock, or learning module **lesson** can become published. A stem requires a category, question tags, valid answer structure, and complete student-facing explanations. A published parent may contain only published children, and a public parent may contain only public children. A lesson may publish only when every assessment block references published (non-deleted) stem/question content and has no pending generated placeholders; those stems may still be private so the lesson can grant access without putting them in the public pool.
  _Avoid_: Generation gate, review status, quality score

- **UCAT attempt content snapshot** — The immutable copy of the stem, question, answer options, correct-answer metadata, and explanations stored when a question attempt is created. Completed and in-progress attempt review renders from this snapshot so later catalogue edits, withdrawal, or deletion cannot change what the student saw.
  _Avoid_: Content version, live question lookup, resume snapshot

- **Question source channel** — The system-recorded workflow that first created a question stem, such as individual authoring, bulk import, or AI generation. This is provenance for tutor operations, not student-facing content.
  _Avoid_: Question type, answer mode, category

- **Tutor source note** — Optional free-text provenance entered by a tutor to describe where source-derived UCAT content came from. It complements the question source channel and is not shown to students.
  _Avoid_: Citation, student explanation, generation metadata

- **UCAT question set** — An ordered collection of question stems that a student can attempt as one practice unit. A set includes every question on each selected stem; question counts are derived from the selected stems, so tutor auto-selection may approximate a requested question total rather than match it exactly. Students cannot generate or persist their own sets.
  _Avoid_: Individual question playlist

- **UCAT set instruction section** — The UCAT section whose instructions are shown before a question set. For a multi-section set, this is the section represented by the largest number of stems in that set; ties use the earliest canonical UCAT section order. Its instruction content and instruction timing define the set's instructions segment.
  _Avoid_: First stem section, arbitrary section

- **Stem available in the question pool** — A published public question stem that is not included in any published, non-deleted question set. Draft and in-review sets do not reserve their stems from the pool.
  _Avoid_: Unused question, not attempted, not in any set

- **Set available in the sets pool** — A published public question set that is not included in any published, non-deleted mock exam. Draft and in-review mocks do not reserve their sets from the pool.
  _Avoid_: Unused set, not attempted, not in any mock

- **Question stem review queue** — The tutor workflow for reviewing all in-review question stems, applying edits, and either publishing or returning each stem to draft. AI-generated stems enter this queue automatically; tutor-authored stems enter only when a tutor sends them for review.
  _Avoid_: AI approval queue, bulk approval, generated questions tab

- **AI question stem assessment** — A supplementary automated assessment of the exact saved content of an in-review question stem, composed of shared-stem findings and per-question findings. It runs only after the stem passes deterministic UCAT format checks, but its absence, status, or findings never prevent an authorised tutor from publishing. A shared-stem change makes every question finding stale, while an isolated question change makes only that question's finding stale; stale findings are not current assessments.
  _Avoid_: AI approval, permanent quality score, generation warning

- **AI assessment run** — The durable background execution that produces an AI question stem assessment without requiring any staff app to remain open. An initial run may assess all questions together to reuse shared context, while a later run targets only invalidated findings. Equivalent requests are deduplicated, superseded results are discarded, and transient failures receive three automatic attempts before the assessment becomes unavailable and offers a manual retry. Reaching the shared UCAT AI daily budget defers the run until the next reset without consuming a failure attempt. Publishing does not cancel a run already requested for the published content; its eventual result remains supplementary and cannot reverse publication.
  _Avoid_: Browser task, foreground review, indefinite retry loop

- **Question stem review cycle** — A period beginning whenever a question stem enters or re-enters `in_review` and ending when it leaves that status. Each stem requests one automatic assessment for its submitted content during the cycle; relevant saved content changes refresh only invalidated findings. The tutor may publish before, during, or after that work. Changing the configured assessment model does not start another assessment, while a later review cycle does even when the submitted content is unchanged. Draft edits do not request assessment work; relevant edits to an already assessed published stem refresh affected findings in the background without changing its publication state. Enabling the feature does not backfill stems whose current review cycles began earlier.
  _Avoid_: Model-change re-review, permanent assessment, app session

- **AI assessment audit record** — The immutable, compact history of a completed or dismissed assessment, including the reviewed content fingerprint and compact snapshot, model provenance, structured findings and suggestions, tutor decisions, and dismissal reasons. It does not retain duplicated image binaries, rendered screenshots, complete prompts, hidden reasoning, or raw provider responses; the current assessment is shown by default while earlier records remain available for audit.
  _Avoid_: Raw AI log archive, duplicated asset history, current assessment

- **Post-publication AI assessment alert** — A deduplicated notification to the tutor who published a stem when an assessment that was still running at publication later returns a Critical finding. It links to the published stem and its AI Review panel but never changes publication state; passes, ordinary concerns, stale results, and provider failures do not send an alert.
  _Avoid_: Automatic unpublish, general assessment notification, provider-failure alert

- **UCAT format check** — A deterministic validation of structural requirements such as question and option counts, exact answer-mode labels and ordering, stored question type, required instructions, and required visual structure. A failed format check leaves the stem available in the question stem review queue, prevents the AI question stem assessment from running, and identifies the exact structural errors for the tutor. Saving a structurally valid version starts the assessment automatically. Format checks are displayed separately from AI findings, do not consume reviewer-model tokens, and do not add an AI-specific publication gate beyond the platform's ordinary content validation.
  _Avoid_: Category-fit score, AI format opinion, UCAT authenticity assessment

- **UCAT authenticity and task quality** — The judgement-based portion of an AI question stem assessment that evaluates whether the underlying cognitive task, scenario, reasoning demand, wording, and distractors genuinely resemble a fair UCAT question after deterministic format requirements have passed. It does not assess Quantitative Reasoning category fit because QR categories describe information presentation rather than strict question types; deterministic QR category inference remains metadata rather than a quality score.
  _Avoid_: Category format compliance, QR category fit, answer-mode validation

- **AI assessment rubric** — The common review structure covering answer validity; explanation accuracy, clarity, and teaching quality; question clarity and fairness; difficulty and timing; UCAT authenticity and task quality; content appropriateness; and visual integrity. Each applicable category reports Pass, Concern, Critical, Unreviewable, or Not applicable with confidence, evidence, findings, and bounded suggestions; there is no composite numeric quality score.
  _Avoid_: Overall AI score, category-fit score, publication decision

- **Blind question solution** — An answer and concise auditable justification produced from a question stem, question, options, and relevant images without access to the keyed answer, existing explanations, author rationale, or claimed difficulty. An AI question stem assessment compares this independent solution with the keyed answer and teaching explanation in a separate assessment stage.
  _Avoid_: Hidden chain-of-thought, answer-key restatement, single-prompt self-check

- **AI assessment finding** — An advisory review concern or improvement identified by an AI question stem assessment. Severity and confidence help the tutor prioritise attention, but findings never approve, reject, or block publication; the authorised tutor's judgement is final.
  _Avoid_: Publication readiness issue, automatic rejection, generation gate

- **AI finding dismissal** — A tutor's optional reasoned decision not to act on an AI assessment finding for the exact reviewed content in the current review cycle. Dismissal supports workflow organisation and audit rather than publication permission, and rejecting the associated suggestion does not dismiss the finding. A relevant content change or a later review cycle requires a fresh decision, while the earlier dismissal and reason remain in the AI assessment audit record.
  _Avoid_: Suggestion rejection, permanent suppression, silent override

- **AI assessment suggestion** — A tutor-accepted or tutor-rejected atomic set of bounded edits proposed to resolve one AI assessment finding. It previews exact before-and-after values and may update existing content, answer keys, explanations, metadata, or a supported semantic visual specification, but it does not add or delete questions or options, edit raw SVG/XML, or change saved content until the tutor saves the amended stem form.
  _Avoid_: Automatic correction, whole-stem rewrite, raw SVG patch, direct save

- **AI visual assessment** — The visual portion of an AI question stem assessment, comparing the original asset, its stored authoring specification and dimensions when available, and its rendered student view. It evaluates content accuracy, legibility, precision fairness, question dependency, and presentation quality; a required visual that cannot be inspected is a high-severity unreviewable finding rather than a pass.
  _Avoid_: Alt-text check, original-image-only review, visual generation gate

- **Reconciliation issue** — A content gap or inconsistency surfaced to tutors for correction, such as a missing question stem category, missing answer explanation, missing question tag, or private stem not assigned to a staff-authored set. A reconciliation issue is resolved by changing the underlying content; it is not the same as AI-generated question stem approval.
  _Avoid_: Approval status, generation warning, validation error

- **Reconciliation issue queue** — The tutor worklist for one kind of reconciliation issue, preserving that issue type's search, filters, ordering, and progress independently from other issue types. The reconciliation overview summarises issue counts and links to queues; it is not itself a combined queue.
  _Avoid_: Reconciliation table, reconciliation tab, combined issue list

- **Potential duplicate candidate** — A pair of question stems in the same UCAT section surfaced for tutor review because their stem text is equal after conservative normalization. The recommendation is derived by progressively comparing their normalized question, answer-option, correctness, and explanation content; it remains a tutor-reviewed reconciliation issue rather than an automatic merge or deletion.
  _Avoid_: Confirmed duplicate, duplicate question, merge instruction

- **Potential duplicate dismissal** — A tutor's decision that one potential duplicate candidate does not require merging or deletion for the exact normalized stem and question-bundle content reviewed. It removes the pair from the active reconciliation issue queue, remains auditable and reversible, and becomes stale when that compared content on either stem changes.
  _Avoid_: Permanent duplicate exclusion, candidate deletion, merge rejection

- **AI-generated question stem** — A UCAT question stem produced by an AI generation workflow. It is expected to be close to publishable and enters the in-review lifecycle stage automatically, but remains unavailable to students until published by a tutor.
  _Avoid_: Auto-published question, synthetic question

- **AI lesson text drafting** — A tutor-requested draft or rewrite of a learning module text block. It uses the surrounding lesson, the tutor's teaching intent, and the block's intended lesson position as context; may produce rich-text teaching structure such as headings, lists, emphasis, and tables; updates only the tutor's unsaved lesson draft until the tutor accepts and saves; and does not itself approve or publish learning content.
  _Avoid_: Auto-authored lesson, published AI lesson, question generation

- **AI question rewrite** — A tutor-requested stem-level rewording of source-derived UCAT content that preserves the same tested skill, answer logic, correct answer, explanation meaning, section, category, tags, difficulty, and time burden while substantially reducing source-text similarity for tutor review. It should change incidental names and named entities while keeping them consistent across the stem, questions, and answer options. It returns an inline part-by-part preview that the tutor must explicitly accept or reject before applying, and uses the shared UCAT AI provider, model profile, budget, and usage logging controls.
  _Avoid_: Regeneration, new question generation, answer-key generation

- **AI answer explanation** — A tutor-requested, fill-missing-by-default student-facing explanation for a UCAT question that already has answer choices and a selected correct answer. It teaches how to solve the question using the stem, question text, all answer options, and the selected correct answer. Multiple-choice questions receive one question-level explanation; syllogism questions receive per-answer-option explanations only. For Verbal Reasoning questions, generated explanations cite the relevant passage paragraph number when they quote, paraphrase, or rely on textual evidence. Generated missing explanations are written directly into empty explanation fields for tutor review and editing unless the AI flags the selected answer or question as likely flawed; flagged questions are left unfilled and surfaced to the tutor with the suspected issue, suggested correction, and an accept-change action when the AI can identify a corrected answer and explanation. The tool uses the shared UCAT AI provider, model profile, budget, and usage logging controls.
  _Avoid_: Answer generation, solution key parsing, question rewrite

- **AI question writing** — A tutor-requested extension of an existing multiple-choice UCAT question stem with one additional question, answer options, one selected correct answer, and a student-facing explanation. It uses the existing stem as the source of facts, avoids duplicating existing questions, and applies the shared UCAT AI provider, model profile, budget, usage logging, and database-backed generation prompt layers for the stem's section, category, and question tags.
  _Avoid_: New stem generation, question rewrite, answer explanation fill

- **Generation brief** — The structured intent for producing AI-generated UCAT content, including section, stem category, target skill tags, difficulty, time burden, format constraints, and optional calibration examples. A generation brief defines what should be created; source examples are optional style calibration and should not be required or copied.
  _Avoid_: Prompt, source stem selection

- **UCAT AI model profile** — An admin-managed provider/model configuration available to UCAT AI workflows, with inference defaults such as model ID, temperature, and maximum completion tokens. Workflows assign enabled profiles to roles such as generation, blind question solving, or assessment; prompt instructions do not belong to a model profile.
  _Avoid_: Generation model profile, prompt profile, UCAT model config

- **Generation system prompts** — The model-independent base and role instructions used by UCAT generation, such as writer, planner, critic, and rewriter instructions. They are edited independently from UCAT AI model profiles and shared across enabled models.
  _Avoid_: Model prompt, prompt profile

- **UCAT AI provider** — An admin-approved model provider available to UCAT AI workflows and identified by its endpoint and secret reference. UCAT AI workflows must not be coupled to one provider.
  _Avoid_: OpenRouter-only integration, hard-coded model

- **UCAT AI settings** — The admin-web settings area for managing UCAT AI providers, model profiles, workflow role assignments, generation prompts, scoped prompt layers, budgets, and run limits. This is separate from score projection settings, which control score projection assumptions.
  _Avoid_: UCAT model config, tutor prompt settings

- **Layered generation prompt** — The combined instructions used for AI generation, assembled from generation system prompts, UCAT section, stem category, question tags, and optional run instructions. Model selection is independent. Admin-managed layers define the stable quality contract; tutor-entered run instructions refine a single generation run without replacing that contract.
  _Avoid_: One big prompt, tutor system prompt

- **Generated content block** — A structured content unit returned by AI generation before conversion into the editor format, such as a paragraph, table, or image request. Generated content blocks are validated and converted by the app instead of asking the AI model to produce raw editor JSON.
  _Avoid_: ProseMirror output, raw rich text JSON

- **Image generation request** — A generated content block that asks the app to create a data-bearing visual asset for a UCAT stem. Image generation is allowed only when the selected stem category warrants visual content, and the generated image spec must be validated against the question and answer logic before the asset is used.
  _Avoid_: Image-dependent VR, image-only table

- **Deterministic exam visual** — A data-bearing UCAT visual asset rendered by the app from a structured spec, such as a QR chart, DM Venn diagram, or simple schematic map. Deterministic exam visuals are preferred over generative image models whenever exact labels, values, and relationships matter.
  _Avoid_: Freeform generated chart, decorative diagram

- **Data-aware chart editing** — Tutor changes to a deterministic chart's source values, labels, scales, legend, colours, or dimensions while the chart's marks remain derived from its data and scales.
  _Avoid_: Freeform Vega editing, dragging data marks

- **AI image revision** — A tutor-directed generative edit that uses an existing non-deterministic image together with its full question-stem context. The result is previewed before the tutor accepts it into the draft.
  _Avoid_: Text-only regeneration, immediate image replacement

- **Editable visual conversion** — Tutor-reviewed replacement of a legacy rendered exam visual with a deterministic exam visual whose structured source can be edited. Conversion is not assumed to recover the legacy visual losslessly.
  _Avoid_: SVG reverse-engineering, automatic legacy migration

- **Manual visual edit** — A tutor's direct change to an exam visual, treated as a human-review override of automatic visual-placement validation. Validation findings may inform the tutor but do not prevent the edit from being applied.
  _Avoid_: Generated-candidate validation, blocked human override

- **UCAT-realistic source visual** — A data-bearing UCAT visual that should be indistinguishable from source material in a real UCAT-style question while remaining logically auditable. It may be a chart, table, Venn/set diagram, map, timetable, or mixed source panel; visual style and layout are part of the tested data-interpretation burden, not decoration.
  _Avoid_: Generic chart, template diagram, decorative source image

- **Set-region expression** — A semantic label for one region of a Decision Making set diagram, defined by which sets are included and which sets are excluded. Set-region expressions describe the logical region that a number belongs to; they are separate from the visual shape layout used to draw the diagram.
  _Avoid_: Venn template slot, fixed diagram template

- **Generation candidate** — One AI-produced answer to a generation brief. The current synchronous workflow generates one candidate for each requested question stem and applies deterministic gates before tutor review.
  _Avoid_: Final generated question, published generated question

- **Generation gate** — A validation check applied to generation candidates before tutor review. Blocking gates reject candidates that break hard UCAT format or answer-validity rules; warning gates surface likely quality issues while still allowing tutor review.
  _Avoid_: Tutor approval, publish approval

- **Generation warning** — A non-blocking quality issue shown during tutor review of an AI-generated question stem. Warnings should appear as lightweight summary and inline badges, with detail available on demand.
  _Avoid_: Rejection reason, validation error

- **Generation metadata** — Audit information stored with an AI-generated question stem, such as UCAT AI model profile, system-prompt version, provider/model, generation brief, source stem IDs, gate results, warnings, usage, generated-at time, and generated-by tutor. Raw prompts and provider responses are not retained by default.
  _Avoid_: Full prompt log, provider transcript

- **Generation solver check** — A generation gate where a separate solver or critic attempts the generated UCAT question independently of the writer's rationale. Solver disagreement blocks high-confidence objective errors, such as QR arithmetic or DM logic mistakes, and warns on plausible ambiguity in more subjective areas such as Situational Judgement or some Verbal Reasoning items.
  _Avoid_: Answer key generation, tutor review

- **UCAT AI budget** — The shared admin-managed limit on UCAT AI cost or volume, such as daily spend and token usage. Automatic assessments, generation, and tutor-requested AI tools consume the same budget; operation-specific run limits may still constrain shapes such as the number of requested stems without creating separate spending pools.
  _Avoid_: Automatic-review budget, tutor quota, student quota

- **Generation similarity gate** — A generation gate that rejects disguised clones of selected source examples or existing UCAT content, such as reused scenario premises, near-identical data relationships, near-identical question wording, or high text overlap. Shared UCAT archetypes, broad topics, calculation skills, passage genres, generic table/chart dimensions, incidental answer-key patterns, and repeated ordinary names or places are acceptable and should not be rejected by themselves.
  _Avoid_: Answer pattern check, topic uniqueness, generic layout check

- **Answer mode** — The answer-option pattern required by a UCAT stem category, such as Verbal Reasoning Reading Comprehension using four options or True, False, Can't Tell using three fixed options. Answer mode is distinct from `multiple_choice`, which is the stored question type for all non-syllogism questions.
  _Avoid_: Question category, question type

- **Question difficulty target** — A coarse generation target for how hard a UCAT question should be: Easy, Medium, Hard, or Mixed. Difficulty targets apply to individual questions, with stem-level and batch-level defaults available for convenience; Mixed batches should distribute generated questions around the estimated difficulty spread of real UCAT questions rather than producing one uniform level.
  _Avoid_: Exact score, rank

- **Question time burden target** — A coarse generation target for the estimated time a student would take to answer a UCAT question correctly: Low, Medium, High, or Mixed. Time burden targets apply to individual questions, with stem-level and batch-level defaults available for convenience; the burden reflects processing load such as long or confusing VR stems, convoluted DM reasoning, or information-dense QR tables.
  _Avoid_: Time limit, section timing

- **Generation diversity plan** — A behind-the-scenes plan for varying generation candidates within a batch, including scenario domains, question archetypes, distractor types, difficulty, time burden, and repeated wording patterns. Tutors influence diversity through broad targets such as Mixed difficulty or run instructions rather than detailed controls.
  _Avoid_: Randomness, prompt temperature

- **Question stem category** — A single label describing the broad stem format within its UCAT section. Quantitative Reasoning categories describe mutually exclusive presentation formats, while Verbal Reasoning categories distinguish answer mode rather than reading skill.
  _Avoid_: Topic, tag, data subtype

- **Answer option** — One selectable response for a UCAT question.

- **Question tag** — A question-level content label describing the skill or topic tested by a UCAT question. Verbal Reasoning reading skills belong here rather than in question stem categories; Decision Making tags describe reusable subskills and wording traps because its categories already cover broad formats; Situational Judgement uses practical scenario tags alongside cross-cutting ethical principle tags.
  _Avoid_: Category, stem type

- **Target question tag** — An optional question tag included in a generation brief to steer AI-generated questions toward specific skills or topics. When target tags are provided, generation gates should check whether the candidate fits them; when omitted, tags may be suggested after generation.
  _Avoid_: Required tag, stem category

- **Stem editor** — The tutor-web workflow for creating or updating a question stem and its nested questions. A single split layout replaces the former separate form and preview modes: UCAT engine chrome on the left (view or inline edit) and a properties column on the right (question navigation card, stem fields, per-question fields, view/edit toggle). All content editing — stem text, question text, answer options, correct answer, and explanations — happens inline on the left in edit mode; the right column holds metadata only. Explanation fields are strict by question type: multiple-choice uses question-level explanation only; syllogism uses per–answer-option explanations only (no scope toggle, unlike bulk import). The exam chrome footer (Previous / Next) drives the active question; the right-column navigation card can jump to any question. The in-chrome Navigator overlay is not shown in the stem editor.
  Used in the stem dialog and the full-page stem detail route (`/ucat/questions/[id]`) with the same layout. Opens in **edit mode** by default. **View mode** is read-only engine preview with an optional show/hide-answer toggle in the right column; **edit mode** always shows answers. View/edit and show/hide-answer controls live in the right column, not the dialog header.
  Switching stem type to syllogism still requires confirmation and resets questions to the syllogism template (single question, five statements); section and category are locked for syllogism stems. Switching to multiple choice updates question type on existing questions without a full reset. The right column is ordered top-to-bottom: view/edit toggle, show/hide answer (view only), question navigation card, AI actions, stem properties, question properties (active question).
  The right-column **question navigation card** lists all questions in the stem, supports jump navigation (synced with the exam chrome footer), and hosts add/delete question actions (minimum one question). Multiple-choice answer options are added or removed inline on the left in edit mode (minimum one). Syllogism stems keep five statements with no add/remove.
  _Avoid_: Question editor, stem dialog form

- **Bulk import** — A tutor workflow for turning pasted source exam content into UCAT question stems, questions, answer options, and answer metadata for review and import. Correct answers are required before leaving the answers step; explanations may be missing until the review step, where the tutor must type or generate them before moving on. The review step is the explanation completion gate and should clearly explain any missing-explanation blocker: multiple-choice questions need a question-level explanation, and syllogism questions need every answer option explained. It supports a whole-import action for generating all missing explanations, plus targeted per-stem or per-question explanation generation from the expanded editor. The answers step supports either a bulk answers document (auto-parsed) or per-question entry in global question order. Multiple-choice: correct answer via option radio; default explanation scope is question-level (toggleable per question to per-option). Syllogism: per-option Yes/No; default explanation scope is per-option. Rich text in all explanation fields.

- **Syllogism image options table** — A Decision Making syllogism source format where the five conclusion statements are supplied as text inside an image of a five-row table rather than as selectable text. The five statements are still answer options for one syllogism question; the image is not a separate question stem or diagram.
  _Avoid_: Syllogism diagram, image question

- **Item-stem numbered Decision Making document** — A Decision Making bulk import source format where a number marker starts a whole item block rather than the question prompt itself. In this format, the item block contains the setup/stem first, and the final paragraph before the answer options is the question prompt.
  _Avoid_: Stem-numbered question, numbered stem question

- **Repeated-stem numbered Quantitative Reasoning document** — A Quantitative Reasoning bulk import source format where each numbered item repeats the same stem/setup before its own question prompt and answer options. Consecutive items with structurally identical stems should import as one question stem with multiple questions, even when repeated pasted images or tables receive different temporary file IDs.
  _Avoid_: Duplicate stem import, QR stem-numbered question

- **Separate stem document (bulk import)** — A bulk import input mode where question stems are pasted from one document and questions from another. Each parsed stem is paired with its own question paste area in one scrollable step. The paste-stems step shows live stem count, truncated previews, and in-editor markers at each split boundary. Per-stem question pastes are parsed questions-only; stem-like content in a question paste triggers a row warning. Uses a six-step wizard (section → paste stems → per-stem questions → answers → review → create set). The default combined-document flow uses five steps (section → paste document → answers → review → create set).

- **Stem split marker** — A delimiter in a separate stem document that begins a new question stem. Marker lines are not included in stem text; content before the first marker is discarded. Numbers need not be consecutive or start at 1. Keyword mode: tutor supplies a prefix (e.g. `Prompt`); split at lines matching prefix + number. Stem-numbers mode: split at line-start `N.` or `N)` only (numbered lists inside passage text do not split). Line-breaks mode: split after N consecutive blank lines (whitespace-only lines count); if none found, treat as one stem and warn.
  _Avoid_: Stem keyword, passage header

## Staff pay tiers

- **Pay tier** — A numbered step on the organisation’s single pay ladder. Each tier has a canonical base hourly rate stored in Altitutor (not synced to QuickBooks automatically).

- **Tier requirement** — A configurable threshold attached to tier _N_ that must be met before a staff member may advance from tier _N_ to tier _N+1_. Requirements are optional per metric; unset kinds do not apply.

- **Eligible for review** — All configured requirements for the next tier are satisfied (including metric overrides). Eligibility does not imply promotion.

- **Tier promotion review** — An admin decision recorded after a check-in: `approved`, `deferred`, or `not_ready`. Only `approved` increments `current_tier_number`. May be linked to a `CHECK_IN` session.

- **Metric override** — An admin-entered additive amount on a stable metric key (e.g. pre-system classes taught), stored in `staff.metric_overrides` JSON.

- **Employment started at** — The date used for tenure requirements; defaults to staff `created_at` and may be edited by admin for migration.

## UCAT online access

- **UCAT Free** — The default online entitlement for a signed-up UCAT student. Grants access to online product areas within configurable, independent usage quotas per area. Does not require a Stripe subscription. A quota of zero for an area means UCAT Free students cannot start that activity.
  _Avoid_: Free trial, free plan

- **UCAT Unlimited** — Unlimited online access to all UCAT product areas while a paid Stripe subscription is active or temporarily `past_due` during failed-billing recovery (or an equivalent entitlement is in place). Includes practice-day billing discounts. The middle paid tier on the subscribe page.
  _Avoid_: UCAT Pro (former name for this tier), online tier

- **UCAT Pro** — Everything in UCAT Unlimited, plus human support entitlements: one online training workshop per month, on-demand help from tutors, and one 1-1 performance review per month. The top paid tier on the subscribe page; requires its own Stripe product.
  _Avoid_: Premium, coaching tier

- **Sign-in method** — A way a person authenticates to one Student account: email and password, Google, or Apple. A Student account may have multiple sign-in methods; connecting or removing one does not merge, replace, or delete the Student account or its learning history.
  _Avoid_: Social account, linked account, separate account

- **Signup onboarding** — The required first-time sequence for newly signed-up UCAT students. Steps: (1) confirm student details and the email used for email-and-password sign-in, (2) set a password, (3) complete or explicitly skip the Guided UCAT sampler, and (4) choose UCAT Free or a paid subscription. Google or Apple may authenticate the initial signup and provide the default email, but every student still establishes email-and-password sign-in during this sequence. A student with clear paid intent may complete checkout before the sampler and return to it afterward. A student with a pending referral gift sees that it is waiting before the sampler and may accept it immediately, while the full gift or plan decision remains the final signup step. `/subscribe` remains for returning students managing or changing plans, not first-time gating.
  _Avoid_: Onboarding flow, signup wizard

- **Signup onboarding gate** — While signup onboarding is incomplete, the student may only reach `/signup/complete` (and auth/API paths required for the wizard). All other app routes redirect to `/signup/complete` at their persisted step. `/subscribe` is not part of first-time gating. Legacy accounts with plan choice recorded but no new completion flag are treated as fully onboarded.
  _Avoid_: Onboarding redirect, subscribe gate

- **Signup onboarding transitions** — Step changes use horizontal slide + fade (~250ms) via `framer-motion`, with the step card as the animated unit. Respects `prefers-reduced-motion`.

- **Guided UCAT sampler** — The short, sequential first experience of Verbal Reasoning, Decision Making, Quantitative Reasoning, and Situational Judgement during Signup onboarding. It uses authentic question controls, adapts the amount of guidance to the student's stated familiarity, and teaches controls in the section where they are useful. It is unscored, consumes no quota, creates no Attempt evidence, and must not be described as a diagnostic.
  _Avoid_: Diagnostic test, scored attempt, question-engine tour

- **UCAT activation checklist** — The temporary dashboard checklist that follows Signup onboarding and leads a new student through exploring every UCAT section, building a Study plan, completing their first Study plan task, and reviewing their first real result. It supports the Study plan's next recommendation rather than acting as a second plan, and disappears after completion.
  _Avoid_: Product tour, permanent task list, second Study plan

- **Section score estimate** — The app's current estimate of a student’s latent UCAT cognitive-section score on the 300-900 scale at a point in time. It is derived from attempt evidence and should be treated as uncertain, not as a known score.
  _Avoid_: Predicted section score, known section score

- **Attempt evidence** — A scored student performance observation that can contribute to a section score estimate, such as a mock section attempt, set attempt, or aggregated practice attempt group. Very small practice samples are not attempt evidence until grouped into a minimally meaningful section-level observation.
  _Avoid_: Individual practice question as score evidence, raw attempt

- **Evidence weight** — The relative influence an attempt evidence item has on a section score estimate. It reflects exam-likeness, timing conditions, recency, and evidence volume rather than treating every observation as equally reliable.
  _Avoid_: Attempt count, raw average weight

- **Effective practice** — The amount of future practice expected to improve a section score estimate after accounting for diminishing returns from very high raw practice volume. It should not assume unlimited improvement from doing more questions.
  _Avoid_: Raw question count, study time

- **Score trajectory** — A projection of future section score estimates over dates. It is driven by effective practice and bounded by a projected ceiling rather than by calendar time alone.
  _Avoid_: Time-only prediction, guaranteed score path

- **Score projection** — The UCAT feature that shows current section score estimates and fixed-horizon score trajectories from attempt evidence. It does not create a study plan, depend on target scores, or depend on a test date.
  _Avoid_: Study planner, goal tracker, target prediction

- **Score projection snapshot** — The trusted total score estimate actually shown to a student on a calendar day, stored at most once per day in the student's timezone. Snapshot history must not be reconstructed later using a newer model.
  _Avoid_: Recomputed historical prediction, attempt average

- **Dashboard trajectory** — The dashboard presentation that overlays a UCAT preparation goal, Study-plan mocks when applicable, and an exact test date on the independent Score projection. The dashboard canvas shows at most 60 days of trusted snapshot history and the next 120 days of bounded projection so `Today` stays in a consistent position. It may describe exam-day progress only when the date is known, the projection has sufficient evidence, and the date falls inside the configured forecast horizon; otherwise it shows baseline progress or a bounded outlook without an on-track judgement. Its `Why` insight may report stored improvement or a section-to-section-target gap, but must not claim that a section caused a precise total-score deficit.
  _Avoid_: Guaranteed target path, sample personalised data, indefinite extrapolation

- **Study plan** — An optional personalised calendar of UCAT study tasks generated through the student's test date from their UCAT preparation goal, score projection, available study days, per-day time limits, and preferred mock day. It may use less than the student's available capacity when that is appropriate and normally increases practice as the test approaches. It is recalculated when progress or planning inputs materially change; it is separate from Score projection and must not present target attainment as guaranteed. A student without a Study plan does not see its calendar or navigation entry.
  _Avoid_: Score projection, fixed timetable, target guarantee

- **Study guidance orb** — The compact guide that is available throughout UCAT study except during an active attempt. It expands from the same unobtrusive orb on mobile and desktop and shows a primary next step plus a less prominent secondary step. It follows today's scheduled work when a Study plan is enabled and follows Next-step guidance otherwise. A dismissible prompt may announce changed guidance without removing that guidance from the expanded orb.
  _Avoid_: Desktop study-plan panel, chatbot, permanent notification banner

- **Next-step guidance** — The rolling pair of suggested activities shown to a student without a Study plan. It is not a hidden calendar and has no forecast, missed-work catch-up, or dated task debt. The primary item is the best immediate action and the secondary item is the next candidate in the same ordered queue. Exact incomplete Attempt review takes priority; otherwise the first guidance visit in the student's calendar day begins with their least-played Skill trainer. Later guidance uses reliable weakness evidence and the student's preparation stage, favouring learning and targeted practice earlier and exam-like sets or mocks closer to the test. Sparse Question-tag evidence must not create a confident weakness by itself.
  _Avoid_: Recommendations mode, hidden Study plan, rolling calendar

- **Study-plan preference** — The student's choice to use a Study plan or have no Study plan. Turning it off retires future scheduled work without deleting completed activity, historical plans, the UCAT preparation goal, or Score projection evidence. Turning it back on creates a fresh future plan from current evidence and planning availability rather than reviving stale scheduled tasks.
  _Avoid_: Permanent opt-out, deleting plan history, recommendations plan

- **Study plan activation setup** — The strongly encouraged but optional setup that first asks whether the student wants a Study plan, then always captures their UCAT preparation goal. Only students choosing a Study plan are asked for available study days and maximum time per day. A student who is unsure may start with a clearly labelled working target, and the initial preferred mock day is inferred from availability rather than requested as another onboarding input. The student may defer setup and reach the dashboard.
  _Avoid_: Required signup step, diagnostic, full settings form

- **UCAT preparation goal** — The student's overall cognitive target score and test timing: an exact UCAT test date when booked, otherwise the test year. It exists with or without a Study plan and supports dashboard goal presentation and score-projection context; students do not enter target section scores. Situational Judgement is excluded from the cognitive total.
  _Avoid_: Study-plan-only target, section target inputs, guaranteed score

- **Available study day** — A weekday the student explicitly permits the Study plan to schedule. The student sets a maximum study duration for each available day; the plan may use fewer available days or less than the maximum duration, especially when the test is distant. A flexible student may instead ask the plan to choose days automatically.
  _Avoid_: Required study day, booked session, tutoring availability

- **Study capacity** — The maximum time the student permits the Study plan to schedule across their available study days. It is a ceiling rather than a commitment: the plan may schedule less and ramp toward it as the test approaches. When capacity is below the plan's recommended workload, the student still receives the best plan possible within that capacity together with a non-blocking target-risk warning and actions to change availability, target score, or test date. Only zero capacity prevents plan generation.
  _Avoid_: Required workload, guaranteed improvement threshold, minimum subscription usage

- **Study plan test timing** — The student's exact UCAT test date when booked, or their test year while no exact date is available. Year-only planning is the normal pre-booking state: the plan uses the midpoint of that year's admin-configured testing window as a clearly labelled provisional planning date and does not ask the student to predict an early, middle, or late sitting. When bookings open, the app prompts for the booked date and recalculates all future Study plan work after it is supplied.
  _Avoid_: Required exact date, hidden assumed date, student-predicted test window

- **Study plan target** — The student's single target for the overall cognitive UCAT score. The Study plan dynamically distributes the required improvement across Verbal Reasoning, Decision Making, and Quantitative Reasoning using current Section score estimates and realistic improvement potential; students do not enter target section scores. Situational Judgement is excluded from this total and managed through a separate automatic goal.
  _Avoid_: Target section inputs, Situational Judgement in total, guaranteed target score

- **Study plan Situational Judgement goal** — The automatically managed standard used to prescribe Situational Judgement learning and practice without adding another onboarding input. It uses Situational Judgement performance evidence and a system-configured readiness standard, but neither contributes to nor competes with the Study plan target.
  _Avoid_: Overall-score contribution, student-entered SJT target, ignored section

- **Study plan rebalancing** — The automatic adjustment made after planned work is missed. Missed tasks remain visible in history but do not accumulate as extra study debt or push a later day beyond its Study capacity. High-value work may be rescheduled; lower-priority work may be replaced or dropped. Near-term tasks may be reconciled when the student next opens the plan, while the full future calendar follows the normal weekly or event-driven recalculation schedule.
  _Avoid_: Backlog rollover, catch-up workload, plan failure

- **Equivalent study activity** — In-app study completed outside a Study plan action that sufficiently matches a planned task's activity type, section or skill focus, timing mode, and required volume. It may automatically satisfy that task so the student is not asked to repeat substantially the same work. Non-equivalent extra activity still contributes to progress evidence and later plan recalculation but does not complete an unrelated task.
  _Avoid_: Any activity counts, plan-only activity, duplicate required practice

- **Partial study task completion** — Recorded progress when a student completes some but not all of a Study plan task's measurable volume. The completed work contributes to progress evidence and plan recalculation, but the task remains visibly partial and its remainder does not automatically become next-day study debt. A mock or benchmark is complete only when its required attempt is finalized.
  _Avoid_: Failed task, automatic completion, remaining-work rollover

- **Study plan task controls** — The intentionally limited actions available on a generated study task: start the prescribed activity or skip it for automatic Study plan rebalancing. Students edit planning inputs such as availability, test date, and target score rather than manually moving, rewriting, or swapping generated tasks. This preserves the student-facing promise that the plan decides what to do next.
  _Avoid_: Timetable editor, drag-and-drop plan, task swap

- **Study plan quota handling** — The Study plan prescribes the same academically appropriate work regardless of Online access tier; it is not weakened to fit UCAT Free quotas. A Free student can see the complete plan and complete tasks while quota remains. A task blocked by quota remains visibly locked with its reset or upgrade action, is not counted as missed, and may contribute to an access-risk warning when the target workload cannot be executed.
  _Avoid_: Paid-only hidden plan, quota-sized academic plan, locked task as non-adherence

- **Study plan calibration phase** — The opening phase used when a student has insufficient Attempt evidence for confident personalisation. It begins immediately and emphasises learning modules, short representative practice, and frequent review rather than requiring a diagnostic mock. Existing history may shorten or bypass calibration. A first mock is scheduled only after the student demonstrates reasonable familiarity with the question types, not merely because their preferred mock day arrives.
  _Avoid_: Mandatory diagnostic mock, first-week mock, unpersonalised permanent plan

- **Study feedback progression** — The Study plan's normal movement from learning and short-loop practice with feedback after each stem, through longer mini practice, into full-section benchmarks and finally mocks. Longer feedback intervals are prescribed only as familiarity grows. This is an adaptive progression rather than a compulsory sequence: credible historical or out-of-plan attempt evidence may place an experienced student directly into a later stage, and learning is prescribed only where evidence indicates it is useful.
  _Avoid_: Fixed course sequence, mocks from day one, mandatory Learn completion

- **Full-section benchmark** — A completed section-length UCAT set or equivalent exam-like section attempt whose feedback is received after the uninterrupted attempt. It provides stronger section readiness evidence than short-loop practice. Before the first prescribed mock, the Study plan normally requires at least one Full-section benchmark in every section and adaptively repeats a section benchmark after targeted remediation when the earlier result reveals fundamental gaps.
  _Avoid_: Any question set, mini-set, mandatory fixed benchmark count

- **Mock readiness** — The Study plan's evidence-based judgement that a student is sufficiently familiar with all sections to benefit from a full UCAT mock. It is normally established through Full-section benchmarks across every section, but a credible completed mock or other equivalent historical evidence may satisfy that requirement without forcing the student through learning and short-loop practice. Test proximity may override incomplete readiness when a mock has become the most useful available baseline.
  _Avoid_: Minimum accuracy gate, mandatory lesson sequence, preferred mock day alone

- **Learning module study-plan priority** — Tutor-managed classification controlling whether a learning module lesson is considered by the Study plan: Essential, Recommended, Optional, or Excluded. Incomplete Essential lessons are prioritised early; Recommended lessons are included when capacity permits; Optional lessons are selected for relevant weaknesses or longer timelines; Excluded lessons are never prescribed. Selection uses this metadata and stable lesson references rather than hard-coded lesson IDs or titles.
  _Avoid_: Hard-coded module list, catalog order as importance, inferred priority from title

- **Learning module practice associations** — Optional many-to-many links from a learning module lesson to the existing Question stem categories and Question tags that it teaches. Categories represent broad question formats; tags represent finer skills, methods, or traps. Separate category and tag junctions preserve those meanings and allow hierarchy-aware matching at section, parent, or descendant level; no separate Study plan taxonomy is created.
  _Avoid_: Study-plan tags, category arrays, polymorphic taxonomy link

- **Estimated lesson duration** — An automatically calculated planning estimate derived from a learning module lesson's current blocks. Text uses reading-time estimation; video uses stored provider duration when available and a fallback otherwise; question and stem blocks use question volume and section timing; skill-trainer blocks use their configured time limit; file blocks add no duration. It is recalculated when lesson content changes and is used for scheduling rather than presented as a completion guarantee.
  _Avoid_: Tutor-entered required duration, fixed time per lesson, exact completion time

- **Score projection settings** — The admin-web settings for score projection assumptions, such as evidence weighting, recency, minimum evidence threshold, effective-practice pace, and trajectory curve constants.
  _Avoid_: UCAT model config, study planner settings

- **UCAT scoring authority** — The shared scoring package used to convert UCAT raw performance into scaled section scores. Score projection consumes scaled scores from this authority and should not define its own raw-to-scaled conversion.
  _Avoid_: Projection-local scoring formula, duplicate score conversion

- **UCAT plan choice** — Step 3 of signup onboarding: subscribe to a paid tier or explicitly continue on UCAT Free. Shown as plan cards and billing interval selector only (not the full `/subscribe` marketing page). Free proceeds immediately; paid routes through Stripe checkout and returns to signup onboarding on success (`/signup/complete?checkout=success`). Checkout abandoned mid-flow resumes the plan choice on next login.
  _Avoid_: UCAT onboarding choice (former name), signup tier selection, onboarding modal

- **In-person UCAT access** — An add-on entitlement for tutor-led UCAT class workflows (e.g. assigned sessions and session content). Independent of UCAT Free, UCAT Unlimited, and UCAT Pro — a student may hold any combination (e.g. in-person + Free, in-person + Pro).
  _Avoid_: Class subscription, in-person tier

- **Manual online access override** — An admin-granted setting on a student that overrides their Stripe-derived online tier. Values: **Default** (follow Stripe), **Force Free** (UCAT Free even if subscribed), **Force Unlimited** (UCAT Unlimited without a subscription), **Force Pro** (paid UCAT Pro entitlements including human-support, without a subscription). Independent of in-person access. No legacy subscriber migration is required — UCAT paid subscriptions are greenfield.
  _Avoid_: Manual grant, comp access

- **UCAT Free quota** — A limit on how much of a specific online product area a UCAT Free student may use within a configured time period. Each area has its own quota and period; quotas do not share a pool. Areas: Learn (learning modules), Practice (questions on submitted practice stems), Sets (set attempts started), Mocks (mock attempts started), Skill trainer (attempts started). A quota of zero disables that area for UCAT Free students.
  _Avoid_: Usage limit, rate limit

- **Quota consumption** — When a UCAT Free quota unit is counted. Practice: each new unique question counts when it first becomes the student's current visible question in the engine; selection, loading, and prefetch do not count, and resuming or revisiting the same question within the quota period does not count again. Learn: each never-before-viewed lesson first opened during the quota period counts; reopening a started or complete lesson does not count again in any future period. Sets, mocks, and skill trainer attempts: when the attempt is started, including attempts later discarded or expired. Consumption timing is independent per area.
  _Avoid_: Usage event, quota hit

- **Quota exhaustion** — What happens when a UCAT Free student reaches an area's limit. Practice: fixed practice may start only within the remaining new unique question allowance for the quota period; if the selected batch is larger, the student may confirm a reduced batch capped at that remaining allowance. Unlimited practice lets the student finish all questions on the currently delivered stem, including answers and feedback, then blocks fetching the next stem once the allowance is exhausted. Sets, mocks, learn, and skill trainer: allow the current in-progress attempt to finish; block starting the next one.
  _Avoid_: Rate limit exceeded, quota reached

- **Reduced fixed practice** — A fixed practice session started from the student's chosen filters but capped to the remaining UCAT Free practice allowance for new unique questions in the current quota period. The student confirms the reduced size; Altitutor keeps whole stems and may return fewer questions than the remaining allowance rather than exceed it. Altitutor does not present a stem-by-stem removal list.
  _Avoid_: Truncated practice, partial practice set

- **Delivered practice stem** — A question stem that Altitutor has already presented to the student inside a practice session. In unlimited practice, the student may finish all questions on a delivered practice stem even if their UCAT Free practice allowance becomes exhausted before the stem is complete.

- **Prefetched practice stem** — A one-stem lookahead fetched while the student works on the current unlimited-practice stem, but not yet presented or delivered. It does not reserve UCAT Free quota entitlement and is excluded from resume, completion, and review until the student advances into it.
  _Avoid_: Delivered stem, queued practice set
  _Avoid_: Current stem (ambiguous without session context), loaded stem

- **UCAT Free quota period** — The rolling window for a UCAT Free quota. Configured independently per area (day, week, or month) in admin settings. Boundaries use the student's timezone: calendar day, ISO week (Monday start), or calendar month.
  _Avoid_: Billing period, reset interval

- **Quota usage card** — A reusable student-facing component showing UCAT Free quota usage per area (e.g. "12 / 20 questions today") and an upsell action to UCAT Unlimited. Shown on each online product area's entry point and on the subscription settings page.
  _Avoid_: Usage widget, limit banner

- **App-scoped notification** — A durable inbox item addressed to exactly one student or staff member and owned by one Altitutor application surface. UCAT notifications appear only in the UCAT app even when the same student also uses the student portal.
- **UCAT exam attempt expiry notification** — A normal-priority, dismissible `ucat_web` inbox item created once per attempt when an untimed persistent attempt expires after seven inactive days. Its attempt-specific dedupe key prevents repeated expiry sweeps from creating duplicates; it has no navigation action because expired attempts are audit-only.
  _Avoid_: Announcement, activity event, toast

- **Notification resolution** — The underlying condition represented by an actionable notification is no longer active, independently of whether the recipient read it. For example, a failed-payment notification is resolved when that invoice is paid.
  _Avoid_: Read notification, dismissed notification

- **Subscribe page** — The authenticated pricing page at `/subscribe` where students compare UCAT Free, UCAT Unlimited, and UCAT Pro. A selector shows only billing intervals currently available for checkout and sets the cadence for both paid tiers; yearly is unavailable at launch. Unauthenticated visitors are redirected to signup first. UCAT Free is the implicit default tier — the Free card is informational (lists quotas) and shows "Current plan" for Free students; it is not a separate signup action.
  _Avoid_: Pricing page, plans page

- **Per-week marketing price** — The headline price on paid plan cards, always shown per week (e.g. `$20/wk`), with a secondary line for the actual bill amount for the selected interval (e.g. `Billed at $1,040/yr`). Converted from the configured period price using day-accurate ratios — not shortcuts such as "four weeks per month". Weekly: as configured; monthly: period price × 7÷30; yearly: period price × 7÷365. Penalty (undiscounted) and practice-day ideal prices use the same conversion; ideal uses the practice-day ideal price for the selected interval. Currency displays as `$` for students in an Australian timezone and `A$` otherwise.
  _Avoid_: Weekly equivalent, normalized price

- **UCAT plan price** — Admin-configured list price for one paid tier at one billing interval (Unlimited or Pro × weekly, monthly, or yearly), including the linked Stripe price ID. UCAT Free has no plan prices. Two Stripe products (Unlimited, Pro); each interval is a separate price on the same product. Fortnight billing is not offered.
  _Avoid_: Stripe price, marketing tier

- **Quota limit modal** — The in-context upsell shown when a UCAT Free student hits an area's quota or tries to start a disabled area (quota of zero). Replaces the former all-or-nothing "Unlock online UCAT access" gate. Message is area-specific; primary action leads to subscribe to UCAT Unlimited.
  _Avoid_: Paywall, access gate

- **Practice quota reached dialog** — The active-practice dialog shown when an unlimited practice session cannot fetch another stem because the student's UCAT Free practice allowance is exhausted. The student may upgrade and return to the same active practice session, or finish the session and review the completed practice attempt.
  _Avoid_: Go back dialog, generic quota modal

- **Quota enforcement** — UCAT Free limits are normally applied when a student performs a quota-consuming action. Practice also has entry and continuation checkpoints: an exhausted student cannot enter an active practice session unless they have already delivered practice work to finish, fixed practice is capped before start, and unlimited practice is checked before fetching the next stem. UCAT Unlimited, UCAT Pro, and admin-granted unlimited overrides are exempt.
  _Avoid_: Route gate, middleware check

- **Online access tier** — A student's current online entitlement: `free`, `unlimited`, or `pro`. Derived in order: admin override (if not Default), then an active subscription or failed-billing recovery (`past_due`), otherwise UCAT Free. `pro` implies all UCAT Unlimited entitlements plus UCAT Pro human-support entitlements. `unpaid`, `canceled`, and `incomplete_expired` do not grant paid access. Independent of in-person access.
  _Avoid_: Plan, subscription tier, marketing tier name

- **Failed-billing recovery** — The temporary Stripe-controlled period after a recurring UCAT payment fails. The subscription is `past_due`; paid access and practice-day discount earning continue while Stripe retries, and the student receives a persistent recovery action plus app/Stripe communications. Stripe owns retry timing; Altitutor does not run a second cancellation clock. At launch, configure a maximum five-day recovery window with approximately three Smart Retries, ending in subscription cancellation.
  _Avoid_: Immediate lockout, Altitutor grace-period job

- **Failed-billing termination** — Exhaustion of Stripe's recovery attempts, represented by `canceled` (preferred Stripe configuration) or `unpaid` (defensive fallback). Paid access ends, the student moves to UCAT Free without losing their account, practice history, or results, pending practice-day discounts are forfeited, and one terminal in-app notice plus email is sent.
  _Avoid_: Account lockout, account cancellation

- **UCAT Pro human-support entitlements** — The tutor-led benefits included in paid UCAT Pro only: one online training workshop per month, on-demand help from tutors, and one 1-1 performance review per month. Referral gifts grant UCAT Unlimited and never include these entitlements. In-product fulfillment (booking, metering) is out of scope until a later release; paid Pro is distinguished in access tier only.
  _Avoid_: Coaching add-on, premium support

- **Plan availability** — A paid tier or billing interval is offered on the subscribe page only when admin has configured the corresponding Stripe product and plan price. Unconfigured tiers show a student-facing "Coming soon" state instead of checkout. UCAT Free is always available.
  _Avoid_: Plan disabled, tier locked

- **Accountability Pricing** — The customer-facing proposition in which consistent UCAT practice earns reductions from the standard subscription price through practice-day discounts.
  _Avoid_: Penalty pricing, penalty fee

- **Practice-day discount** — A paid-tier billing perk: answer the globally configured minimum questions in a calendar day (student timezone) to earn a fixed discount amount off the student's bill. The discount amount and earning cap are configured per billing interval (weekly / monthly / yearly), shared across UCAT Unlimited and UCAT Pro — tier affects only the standard bill, not the discount rules. Each qualifying day earns that interval's configured amount, up to the practice-day discount cap. UCAT Free practice does not contribute. A free referral-gift invoice does not consume or erase earned practice-day discounts; they carry to the next payable renewal.
  _Avoid_: Daily discount, practice credit

- **Practice-day discount cap** — The maximum number of practice-day discounts a student can earn in one Stripe billing period (`current_period_start` through `current_period_end`) for their current billing interval. Configured per billing interval; admin may set any value from 1 up to that interval's canonical period day count (7 for weekly, 30 for monthly, 365 for yearly). Once the cap is reached, further qualifying practice days in that period earn no additional discount until the next period. A student may earn at most one practice-day discount per calendar day (student timezone), regardless of how many qualifying sessions they complete that day.
  _Avoid_: Max credits, discount limit

- **Practice-day ideal price** — The lowest marketing price shown for a paid plan at a given billing interval, assuming the student earns the practice-day discount on every day allowed by the cap: `base plan price − (discount per qualifying day × practice-day discount cap)`. Displayed per week on plan cards using the same day-accurate conversion as other marketing prices.
  _Avoid_: Best price, floor price

- **Practice-day qualification threshold** — The minimum number of questions with an answer actually submitted in one calendar day (student timezone) required to earn a practice-day discount. Unanswered, merely viewed, and timed-out questions do not count; one global setting applies to all billing intervals and paid tiers, and UCAT Free answers do not count.
  _Avoid_: Daily minimum, questions per day

- **Practice-day discount grant** — The moment a qualifying day is recorded: a fixed discount amount (from the config at grant time) is written as a credit and applied as a pending Stripe invoice item on the student's subscription. Grants are immutable — admin config changes affect only future grants, not credits already earned in the current or prior periods.
  _Avoid_: Discount credit, practice reward

- **Practice-day discount progress** — A student-facing count of how many practice-day discounts they have earned in the current Stripe billing period versus the practice-day discount cap for their billing interval (e.g. `8 / 20`). Shown on the subscription management page. Pending invoice items from prior periods are not re-counted toward the current period's cap.
  _Avoid_: Discount tracker, credits earned

- **Practice-day discount forfeiture** — When a paid UCAT subscription ends (cancel completes or payment failure terminates access), any unused practice-day discount credits that have not yet been applied to an invoice are voided. A student who later resubscribes — on any interval — starts with no banked credits from the prior subscription. While a subscription remains active — including during a cancel-at-period-end window — the student may still earn practice-day discounts and those credits apply to that subscription's remaining invoices; forfeiture applies only to what is still pending when access actually ends.
  _Avoid_: Credit expiry, lose discounts

- **UCAT referral** — Immutable attribution of one UCAT student to one existing student through the existing student's referral link. A referred student may have only one referrer and one acquisition gift; using the same Stripe customer or card fingerprint rejects the gift acceptance as a self-referral.
  _Avoid_: Affiliate, ambassador sale

- **Referral gift** — A seven-day offer from one student to another for the recipient's first week or month of UCAT Unlimited at no charge. The gift is always UCAT Unlimited, never UCAT Pro; its access duration is snapshotted from the referrer's status and billing interval when the referral is captured.
  _Avoid_: Free trial, Pro gift, free bill

- **Pending referral gift** — A referral gift that has not been accepted, rejected, or expired. It remains as a persistent actionable notification for seven days and cannot be dismissed; reading the notification does not resolve it.
  _Avoid_: Leaving gift pending, unread gift, dismissible offer

- **Referral gift acceptance** — The recipient explicitly accepts a pending referral gift and starts a UCAT Unlimited subscription through checkout, with the gifted first week or month free. Acceptance requires a distinct Stripe customer and payment method from the referrer; the gift replaces the former trial offer.
  _Avoid_: Start trial, redeem Pro gift, automatic acceptance

- **Referral gift rejection** — The recipient explicitly declines a pending referral gift. Rejection is final and resolves its notification; the recipient receives one UCAT Free quota reset, and a Free referrer also receives one quota reset.
  _Avoid_: Dismiss gift, ignore gift, save for later

- **Earned referral gift** — A week or month of UCAT Unlimited earned by a UCAT Free referrer after the recipient accepts their referral gift. It remains available until the referrer explicitly starts it through checkout and is distinct from a paid referrer's billing reward.
  _Avoid_: Pro gift, trial, automatic upgrade

- **Paid referrer billing reward** — One queued entitlement earned when a recipient accepts a paid student's referral gift. It makes the referrer's next subscription renewal free on their existing tier; it is a billing reward and not a gift of UCAT Pro.
  _Avoid_: Pro gift, referral cash, referral credit

- **Billing interval lock** — A student's billing interval (weekly / monthly / yearly) is chosen at first paid checkout and cannot be changed afterward. Interval is not a plan-change dimension — only tier (UCAT Unlimited ↔ UCAT Pro) may change on an existing subscription. Prevents practice-day discount credits earned under one interval's economics from being applied after switching to a shorter interval.
  _Avoid_: Billing cadence change, switch to monthly

- **Checkout availability** — Whether a specific paid tier and billing interval combination is intentionally offered for new checkout (for example, UCAT Unlimited monthly). Independent of its base price and Stripe Price configuration; an interval is offered when at least one tier at that interval has checkout availability and complete payment configuration.
  _Avoid_: Feature flag, enabled price, configured plan

- **UCAT subscription plan change** — A change to a paid student's tier between UCAT Unlimited and UCAT Pro on the **same billing interval**. A student may have at most one active UCAT subscription at a time. The stored plan always reflects what the student has actually paid for. Billing interval changes are not permitted — see billing interval lock. Moving between UCAT Free and a paid tier is subscribe or cancel, not an in-place plan change.
  _Avoid_: Plan switch, change plan

- **Immediate subscription upgrade** — A tier increase from UCAT Unlimited to UCAT Pro on the same billing interval. New entitlements take effect immediately. The student pays a one-time prorated charge for the tier price difference over the remaining days in the current billing period; the next renewal bills at the full Pro price. No credit is applied for unused time on Unlimited — only the forward-looking differential is charged. Practice-day discount rules are unchanged (shared across tiers); practice-day discount progress continues in the same billing period.
  _Avoid_: Scheduled upgrade, free upgrade

- **Scheduled subscription downgrade** — A tier decrease from UCAT Pro to UCAT Unlimited on the same billing interval. The student may request it at any time; Pro entitlements and billing continue until the end of the current billing cycle, then Unlimited takes effect. No proration or partial refunds.
  _Avoid_: Immediate downgrade, prorated refund
