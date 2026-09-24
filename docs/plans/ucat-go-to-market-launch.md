# Altitutor UCAT go-to-market and launch operating plan

Date: 19 August 2026  
Owner: Founder, supported by administration/social staff and UCAT tutors  
Status: Working launch plan; revise weekly from real external-customer evidence

## 1. Goal and definitions

### Primary outcome

Reach **50 active, externally acquired, paid Altitutor UCAT Unlimited subscriptions on 31 December 2026**.

- Floor: 25 active paid subscriptions.
- Target: 50 active paid subscriptions.
- Stretch: 100 active paid subscriptions.
- Keep 1,000 active paid subscriptions as an ambitious peak-2027-cycle objective, not the December operating forecast.

An **active paid subscription** is an external customer's UCAT Unlimited subscription that is active on the snapshot date and has at least one successful non-zero payment. Exclude staff, friends invited to test, internal students receiving access through classes, admin overrides, referral-only gifts, complimentary access and subsidies from the commercial goal. Report those groups separately where their learning behaviour is useful.

The December date is an internal time constraint, not an external promise. Reforecast after six weeks of external traffic.

### Supporting outcomes

The launch is not healthy if subscription growth is purchased without learning value. Track:

1. externally acquired Free signups;
2. activation within 24 hours;
3. a second active practice day within seven days;
4. week-two learning activity;
5. first successful payment;
6. paid learning activity in weeks one and two;
7. refunds, failed payments and cancellations;
8. support burden and unresolved product-quality problems.

### Initial planning model

Use this as a hypothesis, not a forecast:

| Funnel stage by 31 December | Working target |
| --- | ---: |
| Qualified external signups | 500 |
| Activated external students | 250 (50% of signups) |
| Active paid subscriptions | 50 (20% of activated students) |

Replace both assumed rates once at least 100 external signups and 30 activated external students exist.

## 2. Initial audience wedge

The product can accept a broad audience, but the first campaign needs a narrow promise.

### Primary segment

Students in Australia or New Zealand intending to sit UCAT ANZ in 2027 who:

- are beginning or restarting preparation;
- expect to study independently rather than buy high-touch tutoring;
- feel unsure how to organise practice or identify the next useful task;
- want a lower-cost option without sacrificing progress tracking, realistic practice and review.

### Buyer

Speak to the student as the user and decision leader. Give parents a clear, factual page that explains what is included, Free versus Unlimited, billing, practice-day discounts, cancellation and the not-for-profit mission. Do not make the main product experience sound parent-controlled.

### Secondary segments

- 2028 candidates: offer an early-start pathway, useful free learning and a way to return later. Do not make intensive paid preparation feel necessary this early.
- Parents researching UCAT preparation: use trust, transparency, price clarity and founder/tutor credibility rather than fear.
- Students already using official or competitor resources: position Altitutor as the planning, progress, review and accountability layer; do not require exclusivity.

## 3. Positioning and offer

### Core proposition

**Know where you stand. Know what to do next.**

Altitutor UCAT remembers a student's work, turns it into a practical next step, and lets the student keep preparing for free. Unlimited removes the pace limits for students who want to move faster.

### Distinctive commercial hook

**The more consistently you practise, the less your next Unlimited bill costs.**

Practice-day pricing is a meaningful differentiator and should be tested as a lead acquisition message. Explain the rule, qualifying behaviour, maximum discount and actual upcoming price plainly. Avoid presenting the maximum discount as the ordinary price.

### Proof hierarchy

1. real product demonstrations;
2. real student progress and feedback with written permission;
3. Altitutor's relational in-person history and tutor expertise;
4. transparent Free allowances and live Unlimited pricing;
5. not-for-profit mission and supported access;
6. fast, visible founder response to feedback.

Do not lead with raw question count, vague AI claims, guaranteed score improvement, implied UCAT endorsement or attacks on competitors.

## 4. Founder-led growth without an influencer persona

The founder does not need to be the face of every post.

Founder responsibilities:

- supply accurate opinions, worked explanations and product decisions;
- write or approve genuinely helpful community answers;
- record occasional screen-share or voiceover explanations;
- join short student-observation calls;
- respond visibly and quickly when feedback produces a fix;
- host an optional low-production monthly online office hour when demand exists.

Administration/social staff responsibilities:

- turn founder and tutor expertise into short videos, posts and carousels;
- edit, caption, schedule and repurpose content;
- maintain the experiment and content log;
- route comments, questions and interview candidates;
- publish follow-ups showing what changed after feedback.

Tutor responsibilities:

- give relevant students a trackable card or QR link without pressuring them;
- surface recurring questions and misconceptions;
- introduce willing external candidates for research;
- participate in occasional technique-focused content.

Every public founder contribution should disclose the Altitutor relationship. Ask moderators before promotional posts, and prioritise answering the question even when no link is appropriate.

## 5. First 30 days

### Week 0: commercial and measurement readiness

- Verify signup, Free use, pricing, referral gifts, checkout, payment, cancellation, failed-payment recovery and receipts in production.
- Confirm the repaired UCAT app subscription-config endpoint remains healthy during the production billing smoke test.
- Confirm live pricing remains $15/week and $40/month throughout landing, plan selection, checkout and Stripe.
- Confirm production trial days are zero and remove any stale five-day-trial assumptions from launch QA.
- Mark every existing staff/friend/internal tester so PostHog and commercial reports can exclude them reliably.
- Change reporting timezone from UTC to Australia/Adelaide or explicitly timezone every saved query.
- Define activation and implement any missing events/properties before external promotion.
- Verify session-replay masking, staff access, retention and privacy disclosures.

### Week 1: external founding cohort

- Recruit 10-15 external 2027 candidates through tutors, the school contact, personal introductions and transparent social posts.
- Ask each candidate to complete signup and a first useful activity while sharing their screen or narrating friction where possible.
- Ask five short questions: what prompted preparation now, what they currently use, what confused them, what felt valuable and what would make Unlimited worth paying for.
- Provide no scripted praise request. Record exact language and objections.
- Resolve severe bugs immediately; batch lower-severity requests by repeated evidence.

### Week 2: message and offer experiments

Run three small acquisition messages, each with a distinct tagged landing link:

1. **Direction:** know where you stand and what to do next.
2. **Free access:** start free and keep practising free.
3. **Accountability pricing:** practise consistently and make Unlimited cheaper.

Use organic posts, tutor-distributed QR cards and the existing social accounts. Judge messages by activated external students, not views or clicks.

### Week 3: proof and referral loop

- Publish one real product walkthrough.
- Publish one consented student/tutor story with specific, non-guaranteed proof.
- Trigger referral prompts only after a value moment such as reviewed practice, an achieved consistency milestone or useful progress insight.
- Lead the referral message with the recipient's Unlimited gift.

### Week 4: decide what earns amplification

- Review external acquisition, activation, second-day use, week-two use, Unlimited interest and qualitative feedback by source/message.
- Continue the strongest one or two organic loops.
- Stop tactics that create attention without activated students.
- Begin a small paid or sponsorship experiment only if the commercial path works and at least one message has produced repeatable activation.

## 6. Channel strategy

### Organic/community

Build a repeatable loop:

`student question -> useful answer -> deeper resource or tool -> free product action -> observed outcome -> better answer/product`

Candidate formats:

- concise answers to genuine Reddit and Facebook questions;
- short screen recordings demonstrating a technique or product workflow;
- founder/tutor breakdowns of common preparation mistakes;
- interactive free tools or short diagnostics;
- transparent build/fix updates based on student feedback;
- preparation timelines tied to official milestones;
- product-derived weekly progress examples using consented or clearly labelled demonstration data.

### Tutor cards and physical outreach

- Give each tutor or context a unique QR/UTM link.
- Point the card to one useful outcome, such as starting a personalised free plan, not a generic homepage.
- Print a small first batch and measure scans, signups and activations before reprinting.
- Do not pay for distribution volume alone; optimise for relevant conversations.

### Partnerships and sponsorships

Begin with the existing school contact and relevant student/community organisations. Offer something useful—workshop, diagnostic, supported access or preparation resource—rather than only logo placement. Require a dedicated link/code and a defined review date.

### Paid acquisition

Do not spend the full budget at launch. Use gates:

- Gate 1: production checkout and billing are verified;
- Gate 2: at least 40% of external signups reach the agreed activation event;
- Gate 3: at least 30 external students have activated;
- Gate 4: the landing message and product experience generate some voluntary Unlimited intent or payment.

Then test approximately $300-$500 on one high-intent search or retargeting hypothesis. Increase spend only when cost per activated student and cost per retained paid student are measurable. Set a CAC ceiling after observing actual discounted revenue, billing interval mix, retention and support cost.

## 7. Analytics contract

### Required dimensions

Attach or derive these consistently:

- environment;
- external/internal/test account class;
- anonymous acquisition source, medium, campaign and content;
- first-touch and latest-touch source;
- test year and intended test date/month;
- student versus parent landing journey where relevant;
- Free, paid, gift, subsidy or internal access basis;
- billing interval;
- practice-day discount earned/applied;
- referral attribution;
- activation cohort week.

Do not put names, email addresses, question responses or other unnecessary personal data into analytics event properties.

### Implemented acquisition and subscription contract

- A shared, 180-day first-touch cookie captures the first UCAT landing path, referring domain and standard UTM fields across `altitutor.com` and the UCAT app subdomain. It deliberately excludes the landing query string.
- New signups must answer "How did you first hear about us?" after setting a password. The answer accepts multiple sources; `not_sure` is mutually exclusive.
- Supabase stores observed first touch separately from self-reported sources. Observed first touch is immutable; a self-reported answer can be corrected.
- `signup_completed` is emitted from the server after durable signup and product-relationship writes.
- Stripe webhooks emit `subscription_started`, `subscription_payment_succeeded`, `subscription_renewed`, `subscription_cancellation_scheduled`, `subscription_cancelled` and `payment_failed` after billing state has been processed.
- The commercial acquisition conversion is a `subscription_payment_succeeded` event with `is_paid_acquisition_conversion = true`: the first successful positive-value subscription invoice. A trial or referral-funded zero-dollar period is not a paid conversion.
- Billing events repeat the durable acquisition properties so source-to-payment and source-to-retention breakdowns remain simple and auditable.
- Server events use stable event UUIDs and stable source timestamps so request and Stripe webhook retries are eventually deduplicated by PostHog.

### Proposed activation definition

A student is activated when they have:

1. supplied enough goal/timing information to personalise direction;
2. completed a representative practice activity with submitted answers;
3. reviewed at least one result/explanation or received a meaningful evidence-based next step.

Validate this definition against observed students before hard-coding it as the North Star.

### Weekly dashboard

1. active paid external subscriptions today;
2. new and cancelled paid subscriptions by week;
3. qualified external signups by source;
4. signup -> activation -> second active day -> first payment funnel;
5. median time to activation and payment;
6. week-one, week-two and week-four learning retention by test stage;
7. paid practice retention by billing interval;
8. limit view -> plan view -> checkout -> payment funnel;
9. referral gift -> recipient activation -> recipient payment;
10. discounted versus standard effective price and retention;
11. support contacts, top problems and time to resolution;
12. spend, founder/admin hours and cost per activated/retained paid student by channel.

Treat all activity before the external-launch marker as QA data, not a customer baseline.

## 8. Privacy and access

Internal-only access is still collection and processing of student behaviour. Before external launch:

- confirm replay masks form inputs and sensitive page content;
- avoid capturing passwords, contact fields, payment data and unnecessary answer-level personal data;
- limit replay and person-level analytics access to staff who need it;
- keep an access and retention policy appropriate to the product;
- describe analytics/replay use accurately in customer-facing privacy information;
- never use identifiable student behaviour publicly without specific permission.

## 9. Weekly operating cadence

### Monday-Friday

- 15 minutes: inspect acquisition/activation and urgent support;
- 30-60 minutes: one product, content or community action;
- record the hypothesis, time spent and observable outcome.

### Weekend

- 60 minutes: cohort and channel review;
- 60-120 minutes: student observation/interviews or founder source material;
- 60-120 minutes: highest-evidence product improvement;
- 30 minutes: plan next week's single primary growth experiment.

Keep no more than three acquisition experiments active simultaneously. A solo founder should prefer fast interpretable learning over a large calendar of unowned tactics.

## 10. Immediate launch blockers and decisions

1. Deploy and use the durable `external` / `internal_test` account classification; mark every existing tester as `internal_test` in Admin Web.
2. Configure PostHog's default test-account filter to exclude `account_class = internal_test` and change the project timezone to Australia/Adelaide.
3. Deploy and verify the acquisition table, five-step signup flow, `signup_completed`, subscription lifecycle events, `activation_completed`, and test-year/date identity properties in production PostHog.
4. Confirm `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` are configured for the `stripe-webhooks` Edge Function before the production billing smoke test.
5. Re-run the complete production billing path at $15/week and $40/month.
6. Recruit the first 10-15 external candidates; do not wait for a large content launch.
