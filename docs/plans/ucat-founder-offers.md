# UCAT founder offers

Status: implemented locally on 2026-09-20; deployment pending CI/CD.

## Confirmed direction

- AdminWeb manages founder access passes and founder percentage discounts, with shareable links and manually entered codes.
- Access-pass duration and discount percentage are configured per offer; 14 days and 20% were illustrative starting points, not fixed commercial terms.
- Codes support unlimited or capped redemptions, expiry, and disabling future redemptions. Personal codes can be single-use. Redemption limits count successful benefit grants, not link visits or validation attempts.
- Founder access passes require no payment card, do not renew automatically, and require an explicit purchase for subsequent paid access.
- Founder discounts apply to the current eligible plan price, not a frozen price. They end when the subscription actually ends, not merely when cancellation is scheduled, and do not return on resubscription.
- Founder discounts support weekly, monthly and yearly subscriptions and cannot stack with another promotional discount. The existing billing-interval lock remains in place for this release.
- Stripe remains responsible for subscription billing and recurring percentage discounts. The application owns offer eligibility, invitation redemption and attribution.
- One student-facing invitation/referral code entry flow explains the actual benefit before acceptance. Links carry the offer through signup; access passes do not require a payment checkout.
- Referral attribution remains independent from the benefit selected. Marketing reporting distinguishes benefit redemption, meaningful practice and positive-value payment.
- PostHog reporting should connect offer/campaign/code identity to signup, redemption, activation, first positive-value payment, retention and net revenue. Preserve existing first-touch acquisition evidence.

## Accepted interactions

- Billing intervals remain locked for this release. Discounts work on weekly, monthly and yearly subscriptions selected at purchase.
- Practice-day discounts and earned referrer rewards remain available. The founder percentage reduces the plan price before earned reductions; invoices cannot result in a cash payout. Referral rewards do not remove the ongoing founder discount.
- Existing friend referral mechanics remain unchanged. The shared code entry explains the card requirement and renewal terms separately from no-card administrator passes.
- A student currently on Free may claim one administrator access pass, including a former subscriber who has not consumed another acquisition benefit. Passes cannot chain with a standard trial or referral gift. A subsequent purchase can use a founder percentage discount, with no additional trial after the pass.
- Founder discounts apply only when starting a subscription. Existing subscribers cannot apply them; prior founder discount recipients cannot reclaim the benefit after cancellation.
- Current tiers are Free and Unlimited; historical Pro references are stale.

## Delivery boundaries

- No remote database changes or live offer issuance have been authorized by this planning step. Schema changes, if needed, must be validated locally and shipped through the existing CI/CD process.
- Existing unrelated onboarding and question-engine working-tree edits must be preserved.
- The final implementation must cover redemption concurrency and retry safety, subscription lifecycle handling, and trustworthy server-confirmed analytics outcomes.

## Operating the feature

In AdminWeb, open **Settings → UCAT billing → Founder offers**. Choose access weeks/calendar months or an ongoing percentage, a campaign label, a code beginning `F-`, an optional use cap and an optional redemption deadline. Copy the invitation link for personal distribution. Disabling a code prevents new claims; existing benefits and already reserved checkouts remain valid. Offer terms cannot be edited after creation. Use separate codes within a shared campaign to compare distribution sources.

Existing subscribers are ineligible. Founder passes start on explicit acceptance and end automatically at their recorded timestamp, falling back to UCAT Free. They generate no Stripe subscription or payment. A later subscription starts paid billing immediately; a founder percentage discount may be selected for that purchase. A former subscriber may claim a pass only if they have not already consumed a standard trial or referral acquisition gift.

## Analytics contract

- `invitation_previewed`: browser observation, with `offer_id`, `offer_code`, `offer_kind`, `offer_campaign` for founder offers. It does not count as a redemption.
- `founder_discount_selected`: browser selection before checkout; does not count as a redemption or payment.
- `founder_offer_redeemed`: server-confirmed access grant or Stripe-confirmed discounted subscription, with stable deduplication, `redemption_id`, offer identity/campaign and benefit kind. Access grants also carry `access_ends_at`.
- Existing `signup_completed`, `activation_completed`, and `learning_activity_completed` events acquire durable `founder_access_*` / `founder_discount_*` properties for confirmed benefits. Signup before redemption can be linked through the same identified person; its original event is not rewritten.
- Stripe payment, renewal and cancellation events include offer cohort properties. Discount payment attribution comes from subscription metadata so invoice-before-checkout webhook ordering cannot lose it. Access-pass attribution remains available when the student later pays.
- Existing paid acquisition logic counts only the first positive-value subscription payment. Free access, trial activation, code selection and zero-value invoices do not qualify.

Suggested PostHog funnels: invitation preview → signup → redemption → activation; access-pass redemption → first positive payment; discounted subscription redemption → positive renewal. Break down by code or campaign; compare like exam-preparation cohorts. Sum `amount_paid_cents` on unique `subscription_payment_succeeded` events for collected subscription revenue. This is collected revenue, not refund-adjusted net revenue; reconcile refunds/fees from Stripe for net revenue reporting. No live PostHog dashboards or campaigns are created by the implementation.

## Deployment

Migrations and functions ship through CI/CD. Ensure the Stripe webhook destination delivers `checkout.session.expired` alongside the existing completion and subscription/invoice events, so abandoned checkouts promptly release their places. Configure `NEXT_PUBLIC_UCAT_WEB_URL` in AdminWeb for non-production invitation links (production fallback: `https://ucat.altitutor.com`). Existing Stripe and PostHog credentials are reused. No live offers are issued automatically.

## Local verification (2026-09-20)

- Founder database contracts: 37 passed after a fresh local reset, UCAT seed and generated-type refresh.
- Checkout contracts: 10 passed; shared offer validation: 9 passed; founder webhook and payment analytics contracts: 9 passed.
- Founder browser journey passed: explicit no-card acceptance grants Unlimited, creates no subscription or payment checkout, and cannot consume another place on reload. Public invitation layout also inspected in the browser.
- UCAT/AdminWeb lint and typechecks passed. All 14 build tasks passed with isolated Next build directories, avoiding running development servers.
- The full repository gate is not green: broader database runs encountered unrelated class scheduling/transfer contracts; standalone Stripe webhook typechecking reports eight errors in existing code. A final whole critical-browser-suite rerun was interrupted during seeding by the shared local database being reset (`question_stems` temporarily absent). The founder browser journey passed independently before that interruption.
