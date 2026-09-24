# UCAT email retention and conversion research

Date: 30 July 2026  
Scope: Altitutor UCAT lifecycle and marketing email, with a review of the current repository implementation  
Method: primary research papers, official regulator/provider documentation, and direct inspection of the repository. Vendor claims describe capability, not independently verified effectiveness.

## Executive recommendation

Keep **Supabase as the product-state and consent source of truth** and **Resend as the delivery provider**. The existing foundation is unusually solid for an early lifecycle system: server-side eligibility, durable deduplication, signed delivery webhooks, suppression, one-click unsubscribe, topic preferences, local rendering, plain text, and product-attributed click events are already present.

Do not migrate merely to replace `fetch` with an SDK. Resend's SDK wraps the same API; it would improve ergonomics and typing, not retention or conversion. The larger need is a **campaign control plane**:

1. richer behavioral evidence and event-aware branches;
2. global frequency caps and priority arbitration;
3. campaign drafts, approvals, scheduling, segmentation, and previews;
4. controlled experiments measured on in-product outcomes;
5. a broadcast path for product news and offers;
6. reusable product-derived visual modules.

The practical near-term architecture is hybrid:

- keep required/transactional and high-value personalized lifecycle messages in the existing Supabase → Edge Function → Resend path;
- add a controlled Resend Contacts/Segments/Topics sync; use **Resend Broadcasts** for one-off product news and referral/offer campaigns, and evaluate **Resend Automations** for event-driven journeys;
- add experiment assignment and outcome measurement in Altitutor/PostHog;
- reassess Customer.io or Loops only after campaign iteration by non-engineers or complex journey orchestration becomes a recurring bottleneck.

The content strategy should make every message earn its send. The signature email should not be a newsletter; it should be a small, useful piece of the product: **what you did, what it means, and the one best thing to do next**.

## What the repository currently does

### Architecture

The lifecycle path is not primarily frontend-triggered.

- [`logic.ts`](../../supabase/functions/ucat-lifecycle-emails/logic.ts) selects seven campaigns at 09:00 in the student's time zone: five onboarding messages, a seven-day return message, and a weekly progress message.
- [`index.ts`](../../supabase/functions/ucat-lifecycle-emails/index.ts) is an authenticated scheduled Edge Function. It reads a service-only eligibility view, atomically claims a dedupe key, renders the email, and calls Resend.
- [`20260722073754_ucat_lifecycle_communications.sql`](../../supabase/migrations/20260722073754_ucat_lifecycle_communications.sql) stores topic preferences and immutable consent events, derives product evidence, and provides a durable delivery ledger.
- [`email.ts`](../../supabase/functions/ucat-lifecycle-emails/email.ts) provides responsive, email-safe, UI-inspired modules and both HTML and plain-text output.
- [`resend-webhooks/index.ts`](../../supabase/functions/resend-webhooks/index.ts) verifies signed Resend webhooks, persists provider events, updates suppression, and sends attributed delivery/click events to PostHog.
- [`ucat-email-operations.md`](../ucat-email-operations.md) correctly separates required service messages from optional lifecycle communication and defines an outcome funnel beyond opens.
- Frontend/API code records consent and preferences. Signup completion initializes the four preference topics only after verified marketing consent; it does not directly send the lifecycle sequence.

Transactional email is separately driven by database events, the Stripe webhook, and a retryable outbox. This is the right separation.

### What is already strong

- Clear brand voice and calm, non-shaming reactivation copy.
- One primary CTA per message.
- Personalized weekly activity, estimate confidence, and next-step title.
- Useful plain-text versions, visible preferences/unsubscribe links, and `List-Unsubscribe-Post`.
- Local previews in light/dark mode and template tests.
- Stable campaign UTM attribution.
- Durable dedupe in Altitutor plus Resend idempotency keys. Resend documents that its idempotency window is 24 hours, so the database ledger is the important longer-lived guarantee ([Resend idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys)).
- Signed, idempotent webhook processing is appropriate because Resend webhooks are at-least-once and can arrive out of order ([Resend webhook guarantees](https://resend.com/docs/webhooks/introduction)).
- Provider suppression is incorporated into lifecycle candidate selection.

### Important gaps

1. **The candidate scan does not scale safely.** `index.ts` reads an unordered `.limit(limit)`, capped at 250. Once there are more candidates than the cap, the same arbitrary subset can be scanned every hour and later rows can starve. Eligibility should be calculated/queryable server-side, ordered, and paginated or claimed in batches.
2. **Rigid age windows substitute for a journey state machine.** The onboarding sequence partly checks behavior, but timing is still based on signup day. It cannot express “send the next useful lesson after the student completes X,” stop a sequence on paid conversion, or choose among several competing useful messages.
3. **No global contact policy exists.** There is no cross-campaign frequency cap, priority ordering, quiet-period policy, or protection against a lifecycle message landing beside a broadcast or billing communication.
4. **Experimentation is absent.** The ledger records evidence at send time, but there is no stable random assignment, no variant/control metadata, and no no-email holdout. Subject-line tests alone would optimize a weak proxy.
5. **Outcome data is too coarse.** The candidate view exposes activity counts, one estimate, plan presence, and a next step. It does not expose the student's test date/status, target, section movement, highest-priority weakness, recently improved area, allowance/reset state, recent limit friction, subscription state, or whether the recommended action was completed.
6. **The exact seven-day inactivity condition is brittle.** A failed scheduler run or local-time edge can miss the only eligible day. Re-entry should use a durable “inactive for at least N days and not already sent for this inactivity episode” state.
7. **Product news and offers/referrals have preferences but no send path.** The repo has a `resend_audience_synced_at` field, but no code currently synchronizes contacts, topics, or segments to Resend.
8. **The current content modules are valuable but not yet visually distinctive.** They reproduce UI language in email-safe HTML; they do not yet show real product screens, section movement, an allowance timeline, a worked micro-technique, or feature before/after.
9. **No editorial workflow exists.** A content change requires code, tests, and deployment. That is desirable for core personalized logic but too expensive for a monthly product digest or controlled offer.

## Evidence-backed strategy

### 1. Optimize for the product action, not the click

An email click is an intermediate event. The meaningful retention outcomes are a first timed set, reviewed errors, study-plan completion, return session, representative weekly practice, or completion of the recommended task. The meaningful commercial outcomes are viewing Unlimited after genuine limit friction, checkout completion, retained paid practice, and an activated referred student.

This matches Altitutor's existing measurement direction. Add a conversion window and explicit goal event to every campaign definition, then report:

`eligible → held out / sent → delivered → clicked → intended page → intended action → 7/28-day retained`

Open rate should remain diagnostic. Apple's Mail Privacy Protection downloads remote content without revealing whether the recipient opened the message, so opens are not a dependable human-engagement measure ([Apple Mail Privacy Protection](https://support.apple.com/en-euro/guide/iphone/iphf084865c7/ios)). A click can still be curiosity without value.

### 2. Personalize the decision, not merely the greeting

The most credible evidence for this context is mixed rather than magical:

- A randomized field experiment in a hybrid university course found occasional personalized email nudges increased exam performance by about 0.2 standard deviations and changed study timing ([O'Connell & Lang, 2018](https://doi.org/10.1080/15391523.2017.1408438)).
- A small randomized crossover study of online professional learners found personalized progress-location reminders improved on-time work versus general reminders by an estimated 14 percentage points, but the sample was only 39 adults from a different educational context ([Ericson et al., 2023](https://formative.jmir.org/2023/1/e43977)).
- A randomized MOOC study sent tailored instructor reminders only to learners who had missed a weekly quiz; it reported immediate quiz and cumulative final-exam completion effects ([Kurtz et al., 2022](https://doi.org/10.34190/ejel.20.3.2376)).
- Other email nudges have produced null or ambiguous results; for example, a randomized midterm predicted-grade email was more compatible with no mean final-grade difference ([Rotondi et al., 2023](https://doi.org/10.52041/serj.v22i3.406)), and a personalized career-fair email found no measurable attendance effect ([Davidson, Yongyuan & Price, 2023](https://libjournals.mtsu.edu/index.php/jfee/article/view/2347)).

The responsible conclusion is not “personalization converts.” It is: **specific behavioral relevance is worth testing, and generic nudges are not reliably effective**.

For Altitutor, meaningful personalization means:

- “Your QR accuracy held steady, but time per correct answer improved.”
- “You have attempted enough VR and QR for an early range; DM is still underrepresented.”
- “Your next planned session is 12 minutes and your Practice allowance resets tomorrow at 9:14 am.”
- “You completed the set but have six incorrect or slow answers left to review.”

Avoid exposing a sensitive raw score in a subject line. Use the subject to promise the decision inside: “Your strongest improvement this week—and the next gap to close.”

### 3. Make progress visible, interpretable, and actionable

A meta-analysis of 138 randomized studies found that interventions increasing progress monitoring increased monitoring and promoted goal attainment; the average goal-attainment effect was `d = 0.40`, with larger effects when outcomes were recorded or reported ([Harkin et al., 2016](https://pubmed.ncbi.nlm.nih.gov/26479070/)). The studies were not UCAT-email studies, so this supports the mechanism, not a promised conversion lift.

Apply it through the weekly signature email:

1. **Evidence:** exact practice completed.
2. **Meaning:** one movement or gap, with honest confidence.
3. **Action:** one recommended activity with expected duration.
4. **Commitment:** optionally choose when to do it.

The current weekly module covers (1) and part of (2)/(3). Add section-level movement, outstanding review, and a one-click “Add this to my plan” or “Do this now.”

### 4. Turn intentions into a concrete study appointment

A meta-analysis of 94 tests found implementation intentions—specific “if situation Y, then I will do X” plans—had a medium-to-large effect on goal attainment (`d = .65`) across studied goals ([Gollwitzer & Sheeran, 2006](https://www.socmot.uni-konstanz.de/publications/implementation-intentions-and-goal-achievement-meta-analysis-effects-and-processes)). Again, this is a general mechanism rather than an email benchmark.

The study-plan email should not stop at “set up my plan.” Let the student make a small concrete commitment:

> When will you do your next 12-minute set?

Offer 2–3 genuine time choices based on their stated availability, and land on a prefilled plan action. The conversion event is “session scheduled,” followed by “session completed,” not “plan page viewed.”

### 5. Teach something useful inside the email

Retrieval practice improves delayed retention compared with repeated study in controlled experiments ([Roediger & Karpicke, 2006](https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2006.01693.x/)), and a large quantitative synthesis supports spacing learning episodes rather than massing them ([Cepeda et al., 2006](https://pubmed.ncbi.nlm.nih.gov/16719566/)).

This suggests a high-value `lessons_and_tips` format:

- one specific UCAT technique or misconception;
- one example the student must mentally answer before revealing the explanation;
- a CTA to a 3–5 question targeted drill;
- a later follow-up that retrieves the same idea in a new form.

Do not turn research into claims that Altitutor guarantees score gains. The email's job is to start a useful learning loop, not merely advertise that the platform contains lessons.

### 6. Reactivate without shame or a backlog

The current “you do not need to catch up” direction is excellent. Preserve it. Improve relevance by choosing the smallest resumable unit and acknowledging the actual break:

> Your last completed work was a QR set. The fastest way back is to review its four slow answers—about 6 minutes.

Test a no-email control and at least two states:

- incomplete high-value action (e.g. finished set, not reviewed);
- no clear unfinished action (offer a short fresh diagnostic).

Suppress after the UCAT date, after explicit pause, during an active exam attempt, and when the same student has recently received a higher-priority message.

### 7. Ask for referrals after demonstrated value and lead with the friend's benefit

Altitutor's existing referral design already gives the recipient a meaningful Unlimited gift and rewards successful activation. This aligns with two relevant findings:

- In two field experiments and an incentivized lab study, recipient-benefiting (“prosocial”) referral incentives recruited more new customers than sender-only incentives; the authors attribute this partly to the referrer's reputational benefit ([Gershon, Cryder & John, 2020](https://doi.org/10.1177/0022243719888440)).
- Referral-program participation was associated with greater referrer loyalty in a telecom field experiment, though this is a different product/category and should not be treated as a UCAT forecast ([Garnefeld et al., 2013](https://doi.org/10.1509/jm.11.0423)).

Send referral prompts only after a value moment: first reviewed mock, meaningful section improvement, consistency milestone, or a useful weekly report. Lead with:

> Give a friend one free week/month of Unlimited.

Then explain the referrer's reward transparently. Measure recipient activation and retained practice, not shares or clicks. Avoid pressure to market to friends and never imply that referrals are necessary to keep Free useful.

### 8. Use product news as education, not a changelog

Product news should be a targeted monthly digest at most, with one primary story:

- **Problem:** “Reviewing a mock made it hard to see which misses were timing problems.”
- **Change:** annotated screenshot or short UI strip.
- **Benefit:** “You can now separate incorrect answers from unusually slow correct answers.”
- **Action:** “Review my latest mock.”

Segment by who can use the feature and suppress those who already adopted it unless the message still teaches them something. Combine small releases; do not email each new set or lesson. A product-news preference is permission, not a reason to send.

### 9. Make offers contextual and honest

Do not run undifferentiated discount blasts as the primary conversion strategy. Altitutor's most defensible conversion message is already:

> Keep preparing free, or go Unlimited when you want to move faster.

The best offer triggers are moments where Unlimited solves an observed constraint:

- the student reached a Free allowance and has an upcoming planned session before reset;
- the student has sustained high weekly practice velocity;
- the student has a near test date and an incomplete representative mock baseline;
- a referral gift is available or expiring.

Show the free path and exact reset alongside the paid path. The email can quantify convenience (“your next Practice reset is…”) without making anxiety-based claims. Test offer framing and timing against no offer, and track refunds/cancellations and retained practice—not only checkout.

## Proposed campaign system

| Journey | Trigger | Value delivered in the email | Primary action | Primary outcome |
| --- | --- | --- | --- | --- |
| Welcome | Verified signup; setup incomplete | 3-step orientation with a 10–15 minute first session | Start the smallest representative set | First meaningful practice |
| Activation branch | No evidence after 24–48h | Concrete 10–15 question recipe | Start preconfigured timed drill | Drill completed + reviewed |
| Success branch | First evidence created | Interpret the first signal and explain uncertainty | Review first misses | Review completed |
| Plan | Evidence exists; no schedule | Suggested next session based on target/date/availability | Choose a study time | Session scheduled/completed |
| Weekly signature | Useful evidence since last report | Work, movement, gap, next step, allowance | Continue recommended task | Recommended task completed |
| Incomplete review | Set/mock complete; review outstanding | Counts and the most useful misses to inspect | Review remaining answers | Review completed |
| Return | Inactive ≥7d; resumable action exists | Smallest useful continuation, no backlog | Resume one task | Session within 48h |
| Product news | Meaningful release relevant to segment | Before/after and how to use it | Use feature on own data | Feature adoption |
| Free limit | Significant limit friction; offer consent | Exact reset + honest Free/Unlimited paths | Continue Free or compare Unlimited | Retained practice / paid conversion |
| Referral | Positive value moment; offer consent | Friend's gift, sharing copy, referrer terms | Share gift | Referred student activated |
| Pre-test stage | Test date known; stage-specific gap | Readiness checklist, representative next action | Complete planned mock/review | Stage milestone completed |
| Post-test | Test date passed | Congratulate/close loop; optional feedback | Share feedback | Study emails stopped; feedback |

Campaigns should compete in one priority queue. A reasonable initial ordering is:

`required service > time-sensitive study/test action > weekly guidance > onboarding education > product news > offers/referrals`

Start with a conservative optional-email cap such as no more than two in seven days and never two on one local day; then test it. This is a product policy recommendation, not a universal evidence threshold.

## Content and visual design

### Copy contract

Every optional email should answer, above the first CTA:

1. Why did I receive this now?
2. What useful thing did Altitutor observe or teach me?
3. What is the one smallest worthwhile action?
4. How long will it approximately take?

Replace vague CTAs with action/result pairs:

- “Start 12-minute QR set”
- “Review my 4 slow answers”
- “Schedule Tuesday’s 20-minute session”
- “See what changed in mock review”
- “Give a friend free Unlimited”

### Visual hierarchy

Use visuals to compress a decision, not as decoration.

1. **Email-safe HTML product cards for personalized data.** Extend the current modules for weekly movement, section coverage, outstanding review, and allowance/reset. These render when images are blocked and avoid putting sensitive performance data in a remotely fetched personalized image.
2. **Real screenshots for product news.** Use a cropped, annotated screen showing one change. Host immutable, compressed assets on an Altitutor-controlled CDN/storage path, provide width/height, and link to the relevant feature.
3. **Simple instructional diagrams for tips.** A small ratio sketch, decision tree, or worked timing breakdown can make the email itself useful.
4. **Real human imagery sparingly.** Founder/tutor messages can use approved authentic photography. Avoid stock study imagery.

Do not depend on screenshots for the CTA or explanation. W3C guidance requires text alternatives for informative images, null alternatives for decorative images, and equivalent information for complex graphics ([W3C Images Tutorial](https://www.w3.org/WAI/tutorials/images/)). Keep the existing plain-text alternative. Do not put sensitive score information into subject lines, preheaders, image URLs, or reusable CDN filenames.

Suggested visual modules:

- `NextStepCard`: task, section, expected minutes, reason.
- `WeeklyMovementCard`: completed work plus one movement/gap, with confidence.
- `SectionCoverageStrip`: representative coverage, not a misleading rank.
- `ReviewQueueCard`: incorrect and unusually slow answers left.
- `AllowanceTimeline`: remaining amount and exact reset.
- `FeatureBeforeAfter`: two static crops for product news.
- `ReferralGiftCard`: recipient gift first; referrer reward second.

## Measurement and experiments

### Campaign contract

Store for every campaign/version:

- hypothesis;
- eligibility SQL/domain rule;
- topic and priority;
- exclusion/suppression rules;
- template version;
- variant and stable cohort;
- send evidence snapshot;
- one primary in-product outcome;
- conversion window;
- guardrails (unsubscribe, complaint, support contacts, paid cancellation);
- owner, approval, and start/stop dates.

### Experiment order

1. **Utility test:** message versus no-email holdout on intended product action.
2. **Decision test:** generic next step versus evidence-based next step.
3. **Friction test:** CTA to a generic page versus a preconfigured action.
4. **Visual test:** HTML data card versus text-only.
5. **Commercial test:** benefit-first contextual offer versus current/default treatment.
6. Only then test subject/preheader and send time.

Use stable user-level assignment so the same student does not move between treatments. Avoid overlapping experiments on the same outcome. Report absolute conversion, confidence intervals, and guardrails; do not declare a winner from opens.

Customer.io's official documentation illustrates why a true no-message holdout matters: it compares goal conversions among messaged and unmessaged users, while opens/clicks cannot show the message's incremental utility ([Customer.io holdout tests](https://docs.customer.io/journeys/send/workflows/holdout-test/)). This capability can also be implemented in Altitutor's ledger without adopting Customer.io.

## Infrastructure options

### Option A — improve the existing system (recommended now)

**Keep:** Supabase consent/preferences, candidate evidence, outbox/ledger, email rendering, Resend delivery/webhooks, PostHog attribution.

**Add:**

- paginated/claim-based campaign selection;
- campaign priority and cross-campaign frequency cap;
- durable journey states and “at least N days” triggers;
- richer evidence views;
- stable experiment/holdout assignment;
- campaign/version/variant fields in the ledger;
- an admin draft/approval surface or versioned campaign definitions;
- Resend Contact/Topic/Segment synchronization for broadcasts;
- outcome joins/reports in PostHog or a reporting view.

Benefits: the database remains authoritative; personalized product data stays within existing boundaries; transactional guarantees are preserved; no vendor migration. Cost: engineering owns orchestration and experimentation.

### Option B — use more of Resend's campaign layer (recommended adjunct)

Resend now provides global Contacts with properties, internal Segments, recipient-controlled Topics, Broadcasts, a no-code/Markdown editor, scheduling, unsubscribe handling, and marketing analytics ([Resend Audience](https://resend.com/docs/dashboard/audiences/introduction), [Broadcasts](https://resend.com/docs/dashboard/broadcasts/introduction), [Topics](https://resend.com/docs/knowledge-base/why-use-topics)).

It also now has event-triggered **Automations** with condition, delay, wait-for-event, send-email, contact-update, delete, and add-to-segment steps, plus individual run debugging ([Resend Automations](https://resend.com/docs/dashboard/automations/introduction)). This is a meaningful capability upgrade over treating Resend as transport alone.

Use it for:

- monthly product news;
- a targeted referral campaign;
- unusual Free boosts or a limited, approved offer;
- small newsletter-style educational digests.

Do not make Resend the independent consent source of truth. Synchronize Altitutor's four topics to Resend, reconcile webhook/unsubscribe changes back, and gate every Broadcast or Automation from verified consent. The sync does not exist today.

The most sensible Resend-Automations pilot is onboarding or a simple feature-adoption journey. Emit trusted server-side lifecycle events from a durable product-event outbox; do not use frontend-only events as the sole trigger. Keep experiment assignment, consent, canonical send evidence, and business conversions in Supabase/PostHog. Resend's official docs currently show orchestration and run metrics but do not document native randomized holdouts or conversion-goal analysis comparable to Customer.io, so it should not become the only lifecycle record.

### Option C — Loops

Loops provides event/property-triggered Workflows, branching, timers, an editor, campaigns, transactional messages, and workflow experiments ([Loops events](https://loops.so/docs/events), [branching](https://loops.so/docs/workflows/branching), [experiments](https://loops.so/docs/workflows/experiments)). Its official distinction between lifecycle Workflows, one-off Campaigns, and Transactional email maps cleanly to Altitutor ([Loops message types](https://loops.so/docs/guides/transactional-vs-marketing-email)).

Use it if a small team needs a friendlier SaaS journey builder and simple A/B tests without building an admin surface. Trade-offs:

- duplicate customer/event/consent state and synchronization;
- another provider migration and deliverability warm-up;
- current experiments report send/open/click metrics; Altitutor still needs product-outcome analysis and preferably no-email holdouts;
- less control than the current database logic for score evidence and referral/billing semantics.

### Option D — Customer.io

Customer.io offers event-triggered campaigns, automatically updated data-driven segments, conversion criteria, message frequency limits, random cohorts, and native no-message holdouts ([events](https://docs.customer.io/journeys/people/events/), [segments](https://docs.customer.io/journeys/segments/), [frequency limits](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/), [holdouts](https://docs.customer.io/journeys/send/workflows/holdout-test/)).

It is the strongest fit if Altitutor reaches the point where lifecycle marketers need to independently build many multi-step, cross-channel journeys and evaluate conversions. Trade-offs:

- materially greater cost and operational complexity;
- broad replication of student events/properties into a third party;
- consent/suppression synchronization becomes critical;
- migration does not remove the need for Altitutor's domain evidence and transactional outbox.

### SDK versus direct API

Switching from direct HTTP to the official Resend SDK is optional. Resend supports Deno via `npm:resend` ([official Deno example](https://resend.com/docs/send-with-deno-deploy)). The SDK would reduce request boilerplate and provide typed API helpers, including webhook verification, but it does not add journeys, segmentation, experimentation, or better content. Make the change only for maintainability, not as a campaign strategy.

## Deliverability, consent, and safety

The existing implementation is directionally strong. Preserve these non-negotiables:

- Australian commercial email requires prior consent, sender identification/contact details, and a clear unsubscribe that is honored within five working days and does not require login ([ACMA guidance](https://www.acma.gov.au/avoid-sending-spam)).
- Gmail requires SPF/DKIM and, for bulk senders, DMARC alignment, one-click unsubscribe for marketing/subscribed messages, and spam rates below 0.3%; this is a ceiling, not a healthy target ([Gmail sender guidelines](https://support.google.com/mail/answer/81126)).
- Warm sending volume gradually and monitor bounce/complaint signals. Resend's warm-up figures are provider guidance rather than independent benchmarks ([Resend warm-up guide](https://resend.com/docs/knowledge-base/warming-up)).
- Keep required billing/security messages separate from optional marketing.
- Give the student control over the four existing topics. Do not treat account creation alone as blanket permission.
- Minimize personal performance data sent to any new lifecycle SaaS. Document retention, access, deletion, and data-processing terms before adoption.
- Review offer copy against ACCC rules: savings, scarcity, outcome, and condition claims must be accurate and supportable. Referral mechanics deserve specific review because Australian law distinguishes a later request to refer a friend from inducing a purchase with benefits contingent on subsequent referred sales ([ACCC unfair business practices](https://www.accc.gov.au/business/selling-products-and-services/unfair-business-practices)). This paper is product guidance, not legal advice, particularly for students under 18.

## Prioritized implementation roadmap

### Phase 0 — protect delivery and measurement

1. Fix lifecycle scanning with ordered pagination or a database claim function.
2. Add test-date/pause/subscription exclusions and robust `>= inactivity threshold` episodes.
3. Add global optional-message priority/frequency policy.
4. Add campaign version, variant, cohort, and intended-outcome metadata.
5. Build an outcome report for first practice, review, plan setup, recommended-task completion, referral activation, checkout, and retained practice.

### Phase 1 — make the existing emails genuinely useful

1. Enrich the candidate model with section movement/coverage, outstanding review, expected next-task duration, allowance/reset, target/test date, and recent limit friction.
2. Rework onboarding into behavior branches: no evidence, first evidence, first review, first plan.
3. Upgrade the weekly email into the signature “evidence → meaning → next step” product surface.
4. Add preconfigured deep links so the CTA starts the promised task, not a generic page.
5. Add the reusable visual modules described above.

### Phase 2 — launch the missing categories

1. Implement auditable Resend contact/topic sync.
2. Launch one segmented product-news digest using an authentic screenshot and feature-adoption goal.
3. Launch one post-value referral campaign leading with the friend's gift.
4. Launch one contextual limit-friction offer with the Free reset shown equally clearly.

### Phase 3 — learn incrementally

1. Run holdouts on weekly guidance and reactivation.
2. Test evidence-based recommendation versus generic reminder.
3. Test deep-linked task versus dashboard.
4. Test HTML product card versus text-only.
5. Review whether campaign editing/orchestration is consuming enough engineering time to justify Loops or Customer.io.

## Bottom line

Altitutor does not have an email-delivery problem. It has the beginnings of a good product-email system that needs more product evidence, orchestration, editorial control, and causal measurement.

The highest-leverage first change is not more emails or richer decoration. It is to make the weekly and event-triggered messages function like a calm tutor: **observe something real, explain it honestly, and offer one small, preconfigured next action**. Visuals should make that evidence easier to understand. Product news and offers should be sparse, segmented, and useful enough to justify their own category. The existing Resend/Supabase foundation can support this without a platform migration.
