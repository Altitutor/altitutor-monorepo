# Altitutor domain glossary

## Public web surfaces

- **Marketing site** — The public, search-indexable website served from `altitutor.com`. It presents Altitutor's courses, resources, company information, and acquisition pages; it does not own authenticated learning, booking, checkout, or account workflows.
  _Avoid_: Main site, WordPress site, landing pages

- **Product app** — A user-facing application that owns an authenticated or transactional product workflow, such as the student portal or UCAT practice app. Product apps may have public entry pages, but their product workflows are separate from the Marketing site.
  _Avoid_: Landing site, marketing app

## UCAT content

- **UCAT mock exam** — A complete practice exam made of UCAT section content that students can attempt as an exam-like experience.

- **UCAT section** — One of the canonical UCAT areas, such as Verbal Reasoning, Decision Making, Quantitative Reasoning, or Situational Judgement.

- **Learning module** — A node in the UCAT Learn catalog tree. Two mutually exclusive kinds: **folder** (organizes child modules) or **lesson** (delivers ordered content blocks). A module is exactly one kind — never both. May optionally belong to one UCAT section for grouping on `/learn`. Tutors manage the catalog in tutor-web; students browse the tree on `/learn` and open lessons at `/learn/{id}`.
  _Avoid_: Course, topic, unit

- **Learning module folder** — A learning module that contains only child learning modules in display order. Has no content blocks. Completion progress is derived from its descendants. Browsing or expanding folders does not consume UCAT Free learn quota.
  _Avoid_: Category, module group, container node

- **Learning module lesson** — A learning module that contains only ordered content blocks. Has no child modules. The student lesson view (`/learn/{id}`) applies to lessons only. First open of a lesson in the current quota period consumes one UCAT Free learn quota unit; returning to the same lesson in the same period does not consume again. Tutors configure **lesson display mode** per lesson: **scroll** (all blocks on one page with TOC anchor jumps) or **stepped** (one block at a time with previous/next navigation). Gating (`require_completion_before_next`) applies in both modes — in scroll mode, TOC jumps to a block are blocked until prior gated blocks are complete.
  _Avoid_: Learning unit, module page, lesson node

- **Learning module lesson display mode** — Tutor-authored setting on each lesson. **Scroll:** all blocks visible on one scrollable page; table of contents jumps to in-page anchors. **Stepped:** one block visible at a time; footer previous/next moves between blocks. Default for new lessons: stepped.
  _Avoid_: View mode, layout toggle

- **Learning module block** — One ordered content unit within a learning module lesson. Stored in a dedicated blocks table (not inline JSONB on the lesson). Types: rich text, video, file, question stem, single question, or skill trainer set. Images are embedded in rich text blocks only — there is no separate image block type. Video blocks store an external embed URL (YouTube, Vimeo, Loom, etc.) in block `content` — no uploaded video storage in v1. Each block has display order, an optional `require_completion_before_next` gate (default on), and typed foreign keys where the content references existing UCAT entities (stems, questions, files). Simple payloads (e.g. rich text body, video URL) may live in a small JSONB `content` column on the block row. Tutors may attach either a whole question stem or a single question per block — both block types are supported.
  _Avoid_: Lesson section, content chunk, block JSON

- **Skill trainer set** — A tutor-authored, ordered list of skill trainer items drawn from a single skill trainer type (e.g. five Find the word items). Used as the fixed item queue for a skill trainer set block in a lesson and managed in tutor-web separately from the global trainer item bank shuffle.
  _Avoid_: Trainer playlist, drill set

- **Learning module video block** — Embeds an external video URL (YouTube, Vimeo, Loom, etc.) stored in block `content`. Block completion when at least 50% has been watched.
  _Avoid_: Uploaded video, media block

- **Learning module skill trainer block** — A learning module block that references one skill trainer set. The student runs a timed skill trainer attempt using that set's ordered items (not the global bank shuffle). Block completion when that learn-context attempt completes (time expiry or all set items finished). Does not consume UCAT Free skill-trainer quota — only the parent lesson's learn quota applies.
  _Avoid_: Embedded trainer game, inline drill

- **Learning module question block** — A learning module block that embeds UCAT assessment content. **Stem block:** references a question stem; the student works through all questions on that stem. **Question block:** references one question; stem context is shown when the question belongs to a stem. Answers submitted from learn blocks do not consume UCAT Free practice quota.
  _Avoid_: Practice embed, inline quiz

- **Learning module block completion** — Per-block progress tracked for the student. **Text:** scrolled to the bottom. **Video:** at least 50% watched. **File:** embedded viewer (iframe / PDF) entered the viewport, or the download/open link was clicked. **Question stem:** every question on the stem has a submitted answer. **Question:** that question has a submitted answer. A student may manually mark an individual block complete (override). Lesson completion is derived only from block completion — there is no separate lesson flag independent of blocks.
  _Avoid_: Section done, step finished

- **Learning module lesson completion** — A lesson is complete when every block in that lesson is complete (including manually marked blocks). The lesson-level **Mark as complete** control marks all blocks in that lesson complete at once; it does not maintain a separate completion state.
  _Avoid_: Course finished, module done flag

- **Learning module folder progress** — Completion percentage for a folder is rolled up from its descendant lessons and folders (child module completion feeds parent display progress on `/learn`).
  _Avoid_: Category progress, folder checkmark

- **Learning module progress** — Per-student progress on the Learn catalog. **Module progress row:** one per `(student, learning module)` — records `started_at` (first lesson open; consumes learn quota when applicable), cached completion percentage, and timestamps. **Block progress row:** one per `(student, learning module block)` — records block completion, manual override, and type-specific interaction state (e.g. video watch percentage). Lesson completion is derived from block rows; folder completion rolls up from descendant module rows. Block rows are created lazily as the student interacts.
  _Avoid_: Lesson attempt, course enrollment

- **Session-linked learning module** — A learning module lesson attached to a class session via `ucat_sessions_resources` (alongside sets, mocks, and question stems). Only **lessons** may be session-linked — folders are catalog structure only. Students on that session's class roster may open the linked lesson from the session view; access follows the same session-scoping pattern as session-linked question stems.
  _Avoid_: Session course, assigned module folder

- **Learning module visibility** — Each folder and lesson has an `is_private` flag (same model as question stems). New modules default to **private**. There is no separate `is_active` flag — private vs public is the catalog gate; `deleted_at` retires content entirely. **Public** (`is_private: false`) lessons appear on `/learn` for all UCAT students. **Private** lessons are excluded from the global catalog but remain openable when session-linked for rostered students. A folder appears on `/learn` only if it contains at least one accessible descendant lesson (public, or private via session link for that student).
  _Avoid_: Published flag, is_active, catalog toggle

- **Skill trainer** — A gamified, timed UCAT drill that targets one narrow skill (e.g. speed reading, mental maths). Separate from exam questions, sets, mocks, and practice — own catalog, content bank, scoring rules, and attempt history. A student picks a trainer type, plays for a configured time limit, and earns a score. Optional passage text may be imported from an existing question stem when authoring VR items; skill trainer play does not count as practice or exam attempts.
  _Avoid_: Mini practice, drill mode, skill game

- **Skill trainer type** — One of six fixed catalog entries (Find the word, Find the concept, Quick syllogisms, Mental maths, Numpad speed, Calculator maths speed). Each belongs to one UCAT section and has admin-configurable timing and scoring. The catalog is seeded in the database; admin may enable or disable a type but cannot add new types without a code release.
  _Avoid_: Skill trainer game, exercise mode

- **Skill trainer item** — One unit of drill content within a skill trainer type (e.g. one VR passage with keywords and hit targets, one maths question, one calculator button sequence). Authored for the skill trainer bank only; not an exam question stem.
  _Avoid_: Trainer question, drill stem

- **Skill trainer config** — Admin-editable timing and scoring rules for one skill trainer type (time limit, cooldowns, base points, streak rules). Snapshotted when an attempt starts. Interaction tolerances (e.g. hitbox padding around a target sentence) and formulaic scoring for item complexity (mental maths difficulty, numpad sequence length) are computed in application code, not admin settings.
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

- **Question stem visibility** — Whether a UCAT question stem is included in the general question bank. Public stems are available for normal bank selection; private stems are excluded from the general bank and may still be used in deliberate contexts such as system-generated sets or session-linked content.
  _Avoid_: Approval status, published status

- **AI-generated question stem** — A tutor-reviewed UCAT question stem produced by an AI generation workflow. It is expected to be close to publishable, but remains unavailable to students until a tutor reviews and approves it.
  _Avoid_: Auto-published question, synthetic question

- **Generation brief** — The structured intent for producing AI-generated UCAT content, including section, stem category, target skill tags, difficulty, time burden, format constraints, and optional calibration examples. A generation brief defines what should be created; source examples are optional style calibration and should not be required or copied.
  _Avoid_: Prompt, source stem selection

- **Generation profile** — An admin-managed configuration that controls which AI provider/model and prompt instructions may be used for UCAT generation. Tutors may choose among approved generation profiles when creating generation candidates.
  _Avoid_: UCAT model config, API key setting

- **AI generation provider** — An admin-approved OpenAI-compatible model provider used by UCAT generation, defined by endpoint, secret reference, and allowed model IDs. OpenRouter may be the default provider, but generation should not be coupled to one provider.
  _Avoid_: OpenRouter-only integration, hard-coded model

- **UCAT generation settings** — The admin-web settings area for managing AI generation profiles, prompt layers, allowed models, generation budgets, and gate configuration. This is separate from UCAT model config, which controls score prediction constants.
  _Avoid_: UCAT model config, tutor prompt settings

- **Layered generation prompt** — The combined prompt instructions used for AI generation, assembled from the generation profile, UCAT section, stem category, question tags, and optional run instructions. Admin-managed layers define the stable quality contract; tutor-entered run instructions refine a single generation run without replacing that contract.
  _Avoid_: One big prompt, tutor system prompt

- **Generated content block** — A structured content unit returned by AI generation before conversion into the editor format, such as a paragraph, table, or image request. Generated content blocks are validated and converted by the app instead of asking the AI model to produce raw editor JSON.
  _Avoid_: ProseMirror output, raw rich text JSON

- **Image generation request** — A generated content block that asks the app to create a data-bearing visual asset for a UCAT stem. Image generation is allowed only when the selected stem category warrants visual content, and the generated image spec must be validated against the question and answer logic before the asset is used.
  _Avoid_: Image-dependent VR, image-only table

- **Deterministic exam visual** — A data-bearing UCAT visual asset rendered by the app from a structured spec, such as a QR chart, DM Venn diagram, or simple schematic map. Deterministic exam visuals are preferred over generative image models whenever exact labels, values, and relationships matter.
  _Avoid_: Freeform generated chart, decorative diagram

- **Generation candidate** — One AI-produced answer to a generation brief. The workflow may create multiple generation candidates per requested question stem, silently discard candidates that fail blocking gates, then keep only the strongest passing candidates for tutor review.
  _Avoid_: Final generated question, published generated question

- **Generation gate** — A validation check applied to generation candidates before tutor review. Blocking gates reject candidates that break hard UCAT format or answer-validity rules; warning gates surface likely quality issues while still allowing tutor review.
  _Avoid_: Tutor approval, publish approval

- **Generation warning** — A non-blocking quality issue shown during tutor review of an AI-generated question stem. Warnings should appear as lightweight summary and inline badges, with detail available on demand.
  _Avoid_: Rejection reason, validation error

- **Generation metadata** — Audit information stored with an AI-generated question stem, such as generation profile version, provider/model, generation brief, source stem IDs, candidate counts, gate results, warnings, solver scores, usage, generated-at time, and generated-by tutor. Raw prompts, discarded candidates, and provider responses are not retained by default.
  _Avoid_: Full prompt log, provider transcript

- **Generation solver check** — A generation gate where a separate solver or critic attempts the generated UCAT question independently of the writer's rationale. Solver disagreement blocks high-confidence objective errors, such as QR arithmetic or DM logic mistakes, and warns on plausible ambiguity in more subjective areas such as Situational Judgement or some Verbal Reasoning items.
  _Avoid_: Answer key generation, tutor review

- **Generation budget** — An admin-managed limit on UCAT AI generation cost or volume, such as daily spend, token usage, requested stems per run, or internal candidates per requested stem. Generation budgets protect the organisation's API usage without treating ordinary tutor use as abuse.
  _Avoid_: Tutor quota, student quota

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

- **Question stem category** — A single label describing the presentation format of a UCAT question stem within its UCAT section. Quantitative Reasoning uses flat, mutually exclusive presentation categories: Data Tables, Graphs and Charts, Timetables and Calendars, Maps and Diagrams, Mixed Data Sources, and Text-Only Scenarios.
  _Avoid_: Topic, tag, data subtype

- **Answer option** — One selectable response for a UCAT question.

- **Question tag** — A question-level content label describing the skill or topic tested by a UCAT question. A question may have multiple tags, and tags may be hierarchical when the domain has meaningful parent-child relationships; root tags may optionally belong to one UCAT section, while child tags inherit their section from their root.
  _Avoid_: Category, stem type

- **Target question tag** — An optional question tag included in a generation brief to steer AI-generated questions toward specific skills or topics. When target tags are provided, generation gates should check whether the candidate fits them; when omitted, tags may be suggested after generation.
  _Avoid_: Required tag, stem category

- **Stem editor** — The tutor-web workflow for creating or updating a question stem and its nested questions. A single split layout replaces the former separate form and preview modes: UCAT engine chrome on the left (view or inline edit) and a properties column on the right (question navigation card, stem fields, per-question fields, view/edit toggle). All content editing — stem text, question text, answer options, correct answer, and explanations — happens inline on the left in edit mode; the right column holds metadata only. Explanation fields are strict by question type: multiple-choice uses question-level explanation only; syllogism uses per–answer-option explanations only (no scope toggle, unlike bulk import). The exam chrome footer (Previous / Next) drives the active question; the right-column navigation card can jump to any question. The in-chrome Navigator overlay is not shown in the stem editor.
  Used in the stem dialog and the full-page stem detail route (`/ucat/questions/[id]`) with the same layout. Opens in **edit mode** by default. **View mode** is read-only engine preview with an optional show/hide-answer toggle in the right column; **edit mode** always shows answers. View/edit and show/hide-answer controls live in the right column, not the dialog header.
  Switching stem type to syllogism still requires confirmation and resets questions to the syllogism template (single question, five statements); section and category are locked for syllogism stems. Switching to multiple choice updates question type on existing questions without a full reset. The right column is ordered top-to-bottom: view/edit toggle, show/hide answer (view only), question navigation card, stem properties, question properties (active question).
  The right-column **question navigation card** lists all questions in the stem, supports jump navigation (synced with the exam chrome footer), and hosts add/delete question actions (minimum one question). Multiple-choice answer options are added or removed inline on the left in edit mode (minimum one). Syllogism stems keep five statements with no add/remove.
  _Avoid_: Question editor, stem dialog form

- **Bulk import** — A tutor workflow for turning pasted source exam content into UCAT question stems, questions, answer options, and answer metadata for review and import. Explanations are always required on import. The answers step supports either a bulk answers document (auto-parsed) or per-question entry in global question order. Multiple-choice: correct answer via option radio; default explanation scope is question-level (toggleable per question to per-option). Syllogism: per-option Yes/No; default explanation scope is per-option. Rich text in all explanation fields.

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

- **Tier requirement** — A configurable threshold attached to tier *N* that must be met before a staff member may advance from tier *N* to tier *N+1*. Requirements are optional per metric; unset kinds do not apply.

- **Eligible for review** — All configured requirements for the next tier are satisfied (including metric overrides). Eligibility does not imply promotion.

- **Tier promotion review** — An admin decision recorded after a check-in: `approved`, `deferred`, or `not_ready`. Only `approved` increments `current_tier_number`. May be linked to a `CHECK_IN` session.

- **Metric override** — An admin-entered additive amount on a stable metric key (e.g. pre-system classes taught), stored in `staff.metric_overrides` JSON.

- **Employment started at** — The date used for tenure requirements; defaults to staff `created_at` and may be edited by admin for migration.

## UCAT online access

- **UCAT Free** — The default online entitlement for a signed-up UCAT student. Grants access to online product areas within configurable, independent usage quotas per area. Does not require a Stripe subscription. A quota of zero for an area means UCAT Free students cannot start that activity.
  _Avoid_: Free trial, free plan

- **UCAT Unlimited** — Unlimited online access to all UCAT product areas while an active paid Stripe subscription (or equivalent entitlement) is in place. Includes practice-day billing discounts. The middle paid tier on the subscribe page.
  _Avoid_: UCAT Pro (former name for this tier), online tier

- **UCAT Pro** — Everything in UCAT Unlimited, plus human support entitlements: one online training workshop per month, on-demand help from tutors, and one 1-1 performance review per month. The top paid tier on the subscribe page; requires its own Stripe product.
  _Avoid_: Premium, coaching tier

- **Unlimited trial** — A one-time, seven-day trial of unlimited online access. Eligible only if the student has never consumed a trial before. Requires entering payment details at start. May be started from either the UCAT Unlimited or UCAT Pro card on the subscribe page; both share one trial allowance per account. The trial window is fixed at seven days from first start — canceling or converting early does not reset or extend it. During the trial, the student receives UCAT Unlimited entitlements only — UCAT Pro human-support entitlements begin when the subscription becomes paid (`active`), not during `trialing`. The student may cancel or let the trial convert to paid at any point within those seven days. On conversion, the student is billed for whichever paid tier they chose at checkout (Unlimited or Pro). When a trial ends without payment, the student returns to UCAT Free — they are not locked out of the product.
  _Avoid_: Pro trial (ambiguous — trial of Pro card is still online-only until paid), free trial (ambiguous with UCAT Free), 7-day trial

- **Unlimited trial eligibility** — Whether a student may start an Unlimited trial. False once a trial has ever been started on that account, regardless of which card was used or outcome (converted, cancelled, or lapsed). Consumed when a Stripe subscription is created with `trialing` status. Admin comp overrides do not consume trial eligibility.
  _Avoid_: Pro trial eligibility, trial available, can trial

- **Signup onboarding** — The required first-time wizard at `/signup/complete` for newly signed-up UCAT students. Four steps shown in the UI; step 4 has two internal parts (test details, then target scores) that share one progress indicator so the flow does not feel longer than four steps. Steps: (1) student details, (2) set password, (3) choose a plan (UCAT Free, Unlimited trial, or paid subscribe), (4) optional UCAT test details and target scores. Steps 1–3 are required. Step 4 is optional but each part must be intentionally skipped — closing the browser without skipping does not advance progress; the student resumes the same step (and same internal part) on next login. `/subscribe` remains for returning students managing or changing plans, not first-time gating.
  _Avoid_: Onboarding flow, signup wizard

- **Signup onboarding step 4 (test details)** — The optional final signup step, shown as a single "Step 4 of 4" in the UI. **Part A:** choose UCAT test year (required to proceed via Next; options are current calendar year plus the next two years), then optionally a specific test date within that year's UCAT window or "I'm not sure yet" (year saved, date null). **Part B:** optional target section scores (shown only after Part A Next, not after Part A Skip). Skip for now on Part A completes signup without Part B. Back from Part B returns to Part A; paid users returning from Stripe resume Part A without redoing plan selection.

- **UCAT test year** — The calendar year a student expects to sit UCAT, stored on the student profile when set during signup onboarding or later in settings. Independent of a specific test date; when only the year is known, the study planner may show year-level messaging without a day countdown until a date is added.
  _Avoid_: Exam year, sitting year

- **Signup onboarding gate** — While signup onboarding is incomplete, the student may only reach `/signup/complete` (and auth/API paths required for the wizard). All other app routes redirect to `/signup/complete` at their persisted step. `/subscribe` is not part of first-time gating. Legacy accounts with plan choice recorded but no new completion flag are treated as fully onboarded.
  _Avoid_: Onboarding redirect, subscribe gate

- **Signup onboarding transitions** — Step changes use horizontal slide + fade (~250ms) via `framer-motion`, with the step card as the animated unit. Step 4 internal parts use the same pattern under a fixed "Step 4 of 4" indicator. Respects `prefers-reduced-motion`.

- **UCAT target score warning** — A soft, non-blocking caution shown during signup onboarding step 4 part B when the student enters section targets whose combined total is below 1800. Shown as an inline callout while editing; if they press Begin with a low total, a confirmation dialog offers adjust or continue anyway. Skipping targets bypasses the warning. Default pre-filled targets are 800 per section.

- **UCAT plan choice** — Step 3 of signup onboarding: start an Unlimited trial, subscribe to a paid tier, or explicitly continue on UCAT Free. Shown as plan cards and billing interval selector only (not the full `/subscribe` marketing page). Free proceeds immediately; paid routes through Stripe checkout and returns to signup onboarding step 4 on success (`/signup/complete?checkout=success`). Checkout abandoned mid-flow resumes step 3 on next login. Unlimited trial can still be started later from `/subscribe` or upsell CTAs if still eligible.
  _Avoid_: UCAT onboarding choice (former name), signup tier selection, onboarding modal

- **In-person UCAT access** — An add-on entitlement for tutor-led UCAT class workflows (e.g. assigned sessions and session content). Independent of UCAT Free, Unlimited trial, UCAT Unlimited, and UCAT Pro — a student may hold any combination (e.g. in-person + Free, in-person + Pro).
  _Avoid_: Class subscription, in-person tier

- **Manual online access override** — An admin-granted setting on a student that overrides their Stripe-derived online tier. Values: **Default** (follow Stripe), **Force Free** (UCAT Free even if subscribed), **Force Unlimited** (UCAT Unlimited without a subscription), **Force Pro** (paid UCAT Pro entitlements including human-support, without a subscription). Unlimited trial cannot be forced. Independent of in-person access. No legacy subscriber migration is required — UCAT paid subscriptions are greenfield.
  _Avoid_: Manual grant, comp access

- **UCAT Free quota** — A limit on how much of a specific online product area a UCAT Free student may use within a configured time period. Each area has its own quota and period; quotas do not share a pool. Areas: Learn (learning modules), Practice (questions submitted), Sets (set attempts started), Mocks (mock attempts started), Skill trainer (attempts started). A quota of zero disables that area for UCAT Free students.
  _Avoid_: Usage limit, rate limit

- **Quota consumption** — When a UCAT Free quota unit is counted. Practice: first submit on a unique question ID within the period. Sets, mocks, learn modules, and skill trainer attempts: when the attempt is started. Consumption timing is independent per area.
  _Avoid_: Usage event, quota hit

- **Quota exhaustion** — What happens when a UCAT Free student reaches an area's limit. Practice: block immediately after submitting the last allowed question — no further submits in that period. Sets, mocks, learn, and skill trainer: allow the current in-progress attempt to finish; block starting the next one.
  _Avoid_: Rate limit exceeded, quota reached

- **UCAT Free quota period** — The rolling window for a UCAT Free quota. Configured independently per area (day, week, or month) in admin settings. Boundaries use the student's timezone: calendar day, ISO week (Monday start), or calendar month.
  _Avoid_: Billing period, reset interval

- **Quota usage card** — A reusable student-facing component showing UCAT Free quota usage per area (e.g. "12 / 20 questions today") and an upsell action to UCAT Unlimited. Shown on each online product area's entry point and on the subscription settings page.
  _Avoid_: Usage widget, limit banner

- **Subscribe page** — The authenticated pricing page at `/subscribe` where students compare UCAT Free, UCAT Unlimited, and UCAT Pro. A billing-interval selector (weekly / monthly / yearly) above the cards sets the cadence for both paid tiers. Unauthenticated visitors are redirected to signup first. UCAT Free is the implicit default tier — the Free card is informational (lists quotas) and shows "Current plan" for Free students; it is not a separate signup action.
  _Avoid_: Pricing page, plans page

- **Per-week marketing price** — The headline price on paid plan cards, always shown per week (e.g. `$20/wk`), with a secondary line for the actual bill amount for the selected interval (e.g. `Billed at $1,040/yr`). Converted from the configured period price using day-accurate ratios — not shortcuts such as "four weeks per month". Weekly: as configured; monthly: period price × 7÷30; yearly: period price × 7÷365. Penalty (undiscounted) and practice-day ideal prices use the same conversion; ideal uses the practice-day ideal price for the selected interval. Currency displays as `$` for students in an Australian timezone and `A$` otherwise.
  _Avoid_: Weekly equivalent, normalized price

- **UCAT plan price** — Admin-configured list price for one paid tier at one billing interval (Unlimited or Pro × weekly, monthly, or yearly), including the linked Stripe price ID. UCAT Free has no plan prices. Two Stripe products (Unlimited, Pro); each interval is a separate price on the same product. Fortnight billing is not offered.
  _Avoid_: Stripe price, marketing tier

- **Quota limit modal** — The in-context upsell shown when a UCAT Free student hits an area's quota or tries to start a disabled area (quota of zero). Replaces the former all-or-nothing "Unlock online UCAT access" gate. Message is area-specific; primary action leads to Unlimited trial or subscribe to UCAT Unlimited.
  _Avoid_: Paywall, access gate

- **Quota enforcement** — UCAT Free limits are applied when a student performs a quota-consuming action, not at route entry. UCAT Unlimited, UCAT Pro, Unlimited trial, and admin-granted unlimited overrides are exempt.
  _Avoid_: Route gate, middleware check

- **Online access tier** — A student's current online entitlement: `free`, `unlimited_trial`, `unlimited`, or `pro`. Derived in order: admin override (if not Default), then active subscription, otherwise UCAT Free. `unlimited_trial` applies while Stripe status is `trialing`, regardless of whether checkout was for Unlimited or Pro — human-support entitlements are not included. `pro` (paid) implies all UCAT Unlimited entitlements plus UCAT Pro human-support entitlements. Independent of in-person access.
  _Avoid_: Plan, subscription tier, marketing tier name

- **UCAT Pro human-support entitlements** — The tutor-led benefits included in paid UCAT Pro only: one online training workshop per month, on-demand help from tutors, and one 1-1 performance review per month. Not active during Unlimited trial, including trial checkout via the Pro card. In-product fulfillment (booking, metering) is out of scope until a later release; paid Pro is distinguished in access tier only.
  _Avoid_: Coaching add-on, premium support

- **Plan availability** — A paid tier or billing interval is offered on the subscribe page only when admin has configured the corresponding Stripe product and plan price. Unconfigured tiers show a student-facing "Coming soon" state instead of checkout. UCAT Free is always available.
  _Avoid_: Plan disabled, tier locked

- **Practice-day discount** — A paid-tier billing perk: complete the globally configured minimum questions in a calendar day (student timezone) to earn a fixed discount amount off the student's bill. The discount amount and earning cap are configured per billing interval (weekly / monthly / yearly), shared across UCAT Unlimited and UCAT Pro — tier affects only the base (penalty) bill, not the discount rules. Each qualifying day earns that interval's configured amount, up to the practice-day discount cap. Applies to UCAT Unlimited and UCAT Pro subscribers, including during Unlimited trial (`trialing`); credits earned during trial reduce the first paid invoice when the trial converts. UCAT Free practice does not contribute.
  _Avoid_: Daily discount, practice credit

- **Practice-day discount cap** — The maximum number of practice-day discounts a student can earn in one Stripe billing period (`current_period_start` through `current_period_end`) for their current billing interval. Configured per billing interval; admin may set any value from 1 up to that interval's canonical period day count (7 for weekly, 30 for monthly, 365 for yearly). Once the cap is reached, further qualifying practice days in that period earn no additional discount until the next period. A student may earn at most one practice-day discount per calendar day (student timezone), regardless of how many qualifying sessions they complete that day.
  _Avoid_: Max credits, discount limit

- **Practice-day ideal price** — The lowest marketing price shown for a paid plan at a given billing interval, assuming the student earns the practice-day discount on every day allowed by the cap: `base plan price − (discount per qualifying day × practice-day discount cap)`. Displayed per week on plan cards using the same day-accurate conversion as other marketing prices.
  _Avoid_: Best price, floor price

- **Practice-day qualification threshold** — The minimum number of submitted question attempts in one calendar day (student timezone) required to earn a practice-day discount. One global setting for all billing intervals and paid tiers. UCAT Free attempts do not count.
  _Avoid_: Daily minimum, questions per day

- **Practice-day discount grant** — The moment a qualifying day is recorded: a fixed discount amount (from the config at grant time) is written as a credit and applied as a pending Stripe invoice item on the student's subscription. Grants are immutable — admin config changes affect only future grants, not credits already earned in the current or prior periods.
  _Avoid_: Discount credit, practice reward

- **Practice-day discount progress** — A student-facing count of how many practice-day discounts they have earned in the current Stripe billing period versus the practice-day discount cap for their billing interval (e.g. `8 / 20`). Shown on the subscription management page. Pending invoice items from prior periods are not re-counted toward the current period's cap.
  _Avoid_: Discount tracker, credits earned

- **Practice-day discount forfeiture** — When a paid UCAT subscription ends (cancel completes, trial lapses without payment, or payment failure terminates access), any unused practice-day discount credits that have not yet been applied to an invoice are voided. A student who later resubscribes — on any interval — starts with no banked credits from the prior subscription. While a subscription remains active — including during a cancel-at-period-end window — the student may still earn practice-day discounts and those credits apply to that subscription's remaining invoices; forfeiture applies only to what is still pending when access actually ends.
  _Avoid_: Credit expiry, lose discounts

- **Billing interval lock** — A student's billing interval (weekly / monthly / yearly) is chosen at first paid checkout (or Unlimited trial start) and cannot be changed afterward. Interval is not a plan-change dimension — only tier (UCAT Unlimited ↔ UCAT Pro) may change on an existing subscription. Prevents practice-day discount credits earned under one interval's economics from being applied after switching to a shorter interval.
  _Avoid_: Billing cadence change, switch to monthly

- **UCAT subscription plan change** — A change to a paid student's tier between UCAT Unlimited and UCAT Pro on the **same billing interval**. A student may have at most one active UCAT subscription at a time. The stored plan always reflects what the student has actually paid for. Billing interval changes are not permitted — see billing interval lock. Moving between UCAT Free and a paid tier is subscribe or cancel, not an in-place plan change.
  _Avoid_: Plan switch, change plan

- **Immediate subscription upgrade** — A tier increase from UCAT Unlimited to UCAT Pro on the same billing interval. New entitlements take effect immediately. The student pays a one-time prorated charge for the tier price difference over the remaining days in the current billing period; the next renewal bills at the full Pro price. No credit is applied for unused time on Unlimited — only the forward-looking differential is charged. Practice-day discount rules are unchanged (shared across tiers); practice-day discount progress continues in the same billing period.
  _Avoid_: Scheduled upgrade, free upgrade

- **Scheduled subscription downgrade** — A tier decrease from UCAT Pro to UCAT Unlimited on the same billing interval. The student may request it at any time; Pro entitlements and billing continue until the end of the current billing cycle, then Unlimited takes effect. No proration or partial refunds.
  _Avoid_: Immediate downgrade, prorated refund
