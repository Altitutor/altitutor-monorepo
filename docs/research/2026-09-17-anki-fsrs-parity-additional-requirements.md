# Anki FSRS parity: additional scheduler requirements

Date: 2026-09-17
Scope: Current Anki behavior, using only Anki's official manual/FAQ and the official `ankitects/anki` source repository. The comparison question was: what is missing **beyond** the previously identified list of queues/counts, daily limits, parameter optimization and desired retention, revlog, sibling burying, queue ordering, suspension/burying/leeches/undo/reset, day boundaries/time zones, interval fuzz, and mutation-failure recovery?

## Executive answer

Yes. The previous list captures the largest product features, but it omits several scheduler behaviors required for strict functional parity. The highest-impact additions are:

1. exact FSRS implementation/parameter-schema compatibility;
2. actual elapsed-time handling for late and early reviews;
3. exact learning and relearning step transitions, including learn-ahead and FSRS short-term scheduling;
4. deck/preset/home-deck option resolution;
5. Easy Days and Anki's optional load balancing, which shape due dates beyond basic fuzz;
6. rescheduling and memory-state reconstruction when settings, decks, or history change;
7. filtered-deck/custom-study scheduling, especially review-ahead behavior; and
8. atomic answer commits with stale-state rejection.

A fixed 365-day maximum is also an intentional divergence from Anki: current Anki makes maximum interval configurable, defaults it to 100 years, and makes Hard/Good/Easy converge when the cap is reached. [Anki Manual — Maximum Interval](https://docs.ankiweb.net/deck-options.html#maximum-interval)

## Additional core scheduling requirements

### 1. Pin and migrate the FSRS implementation and parameter schema

"FSRS" is not sufficiently precise as a parity target. Current Anki source depends on the `fsrs` Rust crate and currently pins version `6.6.1`; its scheduler code distinguishes empty/default parameters, parameter vectors shorter than 21, and 21-or-more parameter vectors when choosing the forgetting-curve decay. A parity implementation therefore needs an explicit supported FSRS generation, parameter count/schema, default vector, rounding rules, and migration policy rather than relying on a package name alone. [Anki `Cargo.toml`](https://github.com/ankitects/anki/blob/main/Cargo.toml), [Anki `memory_state.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/fsrs/memory_state.rs)

This matters even if optimized parameters are not implemented initially: current Anki invokes the FSRS engine with the selected deck configuration's parameters and persists both the resulting memory state and the effective decay/desired-retention metadata. [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs), [Anki `memory_state.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/fsrs/memory_state.rs)

### 2. Use actual elapsed time, including overdue and early reviews

Anki's FSRS calculation is based on elapsed days since the last review, not merely the card's previously scheduled interval or its nominal due date. The official source derives `days_elapsed` from `last_review_time` (falling back to revlog history) and supplies it to `fsrs.next_states(...)`. [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs)

This is user-visible: Anki's official FSRS FAQ says FSRS is specifically better at scheduling cards reviewed after a delay, such as after a break. [Anki FAQ — What spaced repetition algorithm does Anki use?](https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html#fsrs)

Early reviews also need distinct handling. In a filtered deck, Anki uses a sliding adjustment based on how early the review occurred, so a review performed shortly after the prior review does not receive the same interval as an on-time review. [Anki Manual — Reviewing Ahead](https://docs.ankiweb.net/filtered-decks.html#reviewing-ahead), [Anki `review.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/states/review.rs)

### 3. Match learning/relearning step transitions, not just queue labels

Anki's learning steps are an explicit state machine: Again returns to the first step, Good advances to the next step, Hard uses the average of the first two steps on the first step and repeats the current step later, and Easy exits learning immediately into review. [Anki Manual — Learning Steps](https://docs.ankiweb.net/deck-options.html#learning-steps), [Anki Manual — Easy Interval](https://docs.ankiweb.net/deck-options.html#easy-interval)

Relearning uses the same step model after a review lapse; with no relearning steps, the card skips relearning and receives a one-day interval by default, while the minimum lapse interval constrains the interval after relearning. [Anki Manual — Relearning Steps](https://docs.ankiweb.net/deck-options.html#relearning-steps), [Anki Manual — Minimum Interval](https://docs.ankiweb.net/deck-options.html#minimum-interval)

Intraday steps are time-critical. Anki prioritizes them when due, converts steps that cross the next-day boundary into day-based delays, and—when no other cards remain—can show them early according to the configurable learn-ahead limit, 20 minutes by default. [Anki Manual — Day Boundaries](https://docs.ankiweb.net/deck-options.html#day-boundaries), [Anki Manual — Preferences / Learn ahead limit](https://docs.ankiweb.net/preferences.html#scheduler)

Current Anki also supports FSRS short-term scheduling when learning/relearning steps are empty, and its current source contains a separate preference allowing FSRS short-term scheduling to participate alongside configured steps. [Anki Manual — Learning and Relearning Steps](https://docs.ankiweb.net/deck-options.html#learning-and-relearning-steps), [Anki `preferences.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/preferences.rs), [Anki `learning.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/states/learning.rs)

### 4. Resolve settings from the same deck/preset context as Anki

Anki applies most scheduling options from the card's own subdeck preset, while display-order options come from the deck selected for study; the selected deck and its subdecks also jointly constrain daily limits. [Anki Manual — Subdecks](https://docs.ankiweb.net/deck-options.html#subdecks), [Anki Manual — Daily Limits](https://docs.ankiweb.net/deck-options.html#daily-limits)

For cards temporarily in filtered decks, Anki schedules using the home deck's settings. The source explicitly resolves the original/home deck and its config before calculating FSRS states, and the manual says due reviews return to the home deck with scheduling based on that deck's settings. [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs), [Anki Manual — Due Reviews](https://docs.ankiweb.net/filtered-decks.html#due-reviews)

Desired retention is no longer only preset-wide in the latest Anki: it can be overridden for individual decks within a preset, and the official source chooses the deck-specific value when present. [Anki Manual — Desired Retention](https://docs.ankiweb.net/deck-options.html#desired-retention), [Anki `deck_config.proto`](https://github.com/ankitects/anki/blob/main/proto/anki/deck_config.proto), [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs)

### 5. Implement due-date shaping beyond ordinary fuzz

Easy Days adjusts a calculated interval by a small amount to move work away from selected weekdays; it works with FSRS and affects future intervals rather than retroactively moving existing cards. [Anki Manual — Easy Days](https://docs.ankiweb.net/deck-options.html#easy-days)

Current Anki source also exposes an optional load balancer and passes a load-balancing context into interval selection. This is distinct from merely choosing a random value in the fuzz range, so strict current-source parity requires deciding whether to reproduce it. [Anki `preferences.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/preferences.rs), [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs)

At the maximum-interval cap, Anki intentionally allows Hard, Good, and Easy to collapse to the same delay. Thus enforcing `Hard < Good < Easy` after all caps and rounding would diverge from Anki. [Anki Manual — Maximum Interval](https://docs.ankiweb.net/deck-options.html#maximum-interval), [Anki `review.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/states/review.rs)

### 6. Recompute scheduling state when configuration or card context changes

Anki can optionally reschedule cards immediately when FSRS is enabled or when desired retention/parameters change; otherwise the new configuration affects future reviews only. Immediate rescheduling creates review-log entries and can make many cards due at once. [Anki Manual — Reschedule Cards on Change](https://docs.ankiweb.net/deck-options.html#reschedule-cards-on-change)

Anki reconstructs missing FSRS memory state from review history when a reviewed card is moved or imported into an FSRS deck. When history is truncated or missing, it uses historical retention and inference from the surviving interval/ease data; the user can also exclude revlogs before a chosen date from optimization. [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs), [Anki `memory_state.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/fsrs/memory_state.rs), [Anki Manual — Historical Retention](https://docs.ankiweb.net/deck-options.html#historical-retention), [Anki Manual — Ignore Cards Reviewed Before](https://docs.ankiweb.net/deck-options.html#ignore-cards-reviewed-before)

These behaviors mean that card moves, imports, preset changes, desired-retention changes, and partial-history imports need defined migration semantics; calculating only the next answer transition is not enough for parity. [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs), [Anki Manual — Reschedule Cards on Change](https://docs.ankiweb.net/deck-options.html#reschedule-cards-on-change)

### 7. Support filtered decks/custom study if parity includes Anki's study modes

Anki can temporarily raise today's new/review limits, review recently forgotten cards, review ahead, preview new cards without changing scheduling, or build filtered study queues by state/tag. [Anki Manual — Custom Study](https://docs.ankiweb.net/filtered-decks.html#custom-study)

Filtered decks have two materially different modes: rescheduling mode changes the card according to the answer and home-deck settings, while preview mode returns it unchanged. [Anki Manual — Rescheduling](https://docs.ankiweb.net/filtered-decks.html#rescheduling), [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs)

This can reasonably be treated as extended rather than minimum viable parity, but it is scheduler behavior, not merely UI.

### 8. Make an answer an atomic, concurrency-checked operation

Anki applies an answer inside a transaction. The same operation validates that the card's current scheduling state still matches the state presented to the reviewer, then writes the revlog, daily deck statistics, sibling burying, card state, leech tag, and queue update. [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs)

The stale-state comparison is an additional requirement beyond retrying failed mutations: it prevents a second tab/client or an old screen from rating a card after its scheduling state has already changed. [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs)

## Important refinements to items already on the known list

These are not wholly new categories, but an implementation can still fail parity if it implements only the headline item.

- **Daily limits:** interday learning cards count against the review limit; the review limit blocks new cards by default unless “new cards ignore review limit” is enabled; parent/subdeck limits and permanent versus “today only” overrides interact. [Anki Manual — Daily Limits](https://docs.ankiweb.net/deck-options.html#daily-limits)
- **Queue ordering:** Anki separately defines new-card gather order, post-gather new-card sort order, new/review mixing, interday-learning/review mixing, and review sort order; under FSRS, “ascending retrievability” replaces relative overdueness. [Anki Manual — Display Order](https://docs.ankiweb.net/deck-options.html#display-order)
- **Burying:** Anki gathers intraday learning, interday learning, review, then new cards, and this priority determines which sibling survives; it has distinct switches for new, review, and interday-learning siblings. [Anki Manual — Burying](https://docs.ankiweb.net/deck-options.html#burying)
- **Leeches:** the official source triggers at the threshold and again every half-threshold thereafter (rounded up), and suspension depends on the configured leech action. [Anki `review.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/states/review.rs), [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs)
- **Revlog:** entries include rating, timestamp, answer duration, old/new interval data, and review kind; manual reschedules are represented separately, and reset can preserve the historical review list even though the card is treated as new for future scheduling. [Anki `scheduler.proto`](https://github.com/ankitects/anki/blob/main/proto/anki/scheduler.proto), [Anki Manual — Card Info](https://docs.ankiweb.net/stats.html#card-info), [Anki FAQ — Resetting progress](https://faqs.ankiweb.net/resetting-progress-in-a-deck.html)
- **Manual operations:** “Set Due Date” is separate from reset/forget: it can promote new cards into review and move review due dates while preserving review history, with optional interval changes. [Anki Manual — Browsing / Cards](https://docs.ankiweb.net/browsing.html#cards)
- **Rating contract:** FSRS treats Hard as a successful recall, not a failure; using Hard after forgetting produces unreasonable intervals. A parity UI should communicate and preserve this four-grade meaning. [Anki Manual — FSRS short guide](https://docs.ankiweb.net/deck-options.html#a-short-guide)

## UI, analytics, and operational parity—not core interval mathematics

The following are Anki features and may matter to the product goal, but they can be staged after core scheduler correctness:

- Anki previews the next delay above each answer button using the same generated states that the answer operation will apply. [Anki Manual — Preferences / Show next review time](https://docs.ankiweb.net/preferences.html#review), [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs)
- Anki records capped answer duration for statistics, but the manual explicitly says answer time does not influence scheduling. [Anki Manual — Timers](https://docs.ankiweb.net/deck-options.html#timers), [Anki `answering/mod.rs`](https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs)
- “Help Me Decide” and the FSRS simulator estimate workload at different retention settings. These are configuration/decision-support tools rather than per-answer scheduling requirements. [Anki Manual — Help Me Decide](https://docs.ankiweb.net/deck-options.html#help-me-decide), [Anki Manual — The Simulator](https://docs.ankiweb.net/deck-options.html#the-simulator)
- The former “Compute minimum recommended retention” feature was removed in Anki 25.07, so reproducing it is not required for parity with current Anki. [Anki Manual — Compute Minimum Recommended Retention](https://docs.ankiweb.net/deck-options.html#compute-minimum-recommended-retention)
- Cross-device sync, offline study, backups, import/export, and add-on/custom-scheduler APIs affect Anki product parity, but they are not requirements for mathematical FSRS scheduler parity. Anki nevertheless warns that all clients must support FSRS or scheduling will not work correctly. [Anki Manual — Before Enabling FSRS](https://docs.ankiweb.net/deck-options.html#fsrs)

## Recommended parity boundary

For a credible **scheduler-parity** claim, add the following to the existing gap list before treating filtered decks and advanced tooling as optional:

1. a pinned Anki/FSRS compatibility target with golden transition fixtures;
2. exact elapsed-time, learning/relearning-step, cap/rounding, and short-term behavior;
3. home-deck/preset/deck-specific retention resolution;
4. Easy Days and a documented decision on current Anki load balancing;
5. state reconstruction/rescheduling rules for moves, imports, and configuration changes; and
6. an atomic answer command with stale-state rejection.

Filtered decks/custom study, manual Set Due Date, workload simulation, interval previews, analytics, and sync can be stated separately as **extended Anki product parity**.
