# UCAT founder offers

Status: the card-backed free-period follow-up is being validated locally. It supersedes the no-card policy in the previously deployed revision; its migration, web app and webhook must ship together through CI/CD. This follow-up has not been deployed.

## Confirmed direction

- AdminWeb manages founder access passes and founder percentage discounts, with shareable links and manually entered codes.
- Access-pass duration and discount percentage are configured per offer; 14 days and 20% were illustrative starting points, not fixed commercial terms.
- Codes support unlimited or capped redemptions, expiry, and disabling future redemptions. Personal codes can be single-use. Redemption limits count successful benefit grants, not link visits or validation attempts.
- New founder free-time redemptions require a payment card and automatically charge the selected subscription plan after the free period unless cancelled. Already-redeemed no-card passes retain their original terms.
- Founder discounts apply to the current eligible plan price, not a frozen price. They end when the subscription actually ends, not merely when cancellation is scheduled, and do not return on resubscription.
- Founder discounts support weekly, monthly and yearly subscriptions and cannot stack with another promotional discount. The existing billing-interval lock remains in place for this release.
- Stripe remains responsible for subscription billing and recurring percentage discounts. The application owns offer eligibility, invitation redemption and attribution.
- One checkout code field accepts founder free-time codes, founder percentages and friend-referral codes. “Check code” applies the offer; no separate Start free access action remains. Links carry offers through signup, onboarding and the sampler before plan selection and checkout.
- Referral attribution remains independent from the benefit selected. Marketing reporting distinguishes benefit redemption, meaningful practice and positive-value payment.
- PostHog reporting should connect offer/campaign/code identity to signup, redemption, activation, first positive-value payment, retention and net revenue. Preserve existing first-touch acquisition evidence.

## Accepted interactions

- Billing intervals remain locked for this release. Discounts work on weekly, monthly and yearly subscriptions selected at purchase.
- Practice-day discounts and earned referrer rewards remain available. The founder percentage reduces the plan price before earned reductions; invoices cannot result in a cash payout. Referral rewards do not remove the ongoing founder discount.
- Founder and friend free-time offers use the same card-backed checkout semantics. Applying a free-time code preserves the currently selected renewal interval; its duration determines the introductory period independently of that interval.
- A student currently on Free may claim one administrator access pass, including a former subscriber who has not consumed another acquisition benefit. Passes cannot chain with a standard trial or referral gift. A later new subscription may use a founder percentage discount, but existing subscriptions cannot acquire a second promotion. No extra standard trial stacks with a code.
- Founder discounts apply only when starting a subscription. Existing subscribers cannot apply them; prior founder discount recipients cannot reclaim the benefit after cancellation.
- Current tiers are Free and Unlimited; historical Pro references are stale.

## Delivery boundaries

- No remote database changes or live offer issuance have been authorized by this planning step. Schema changes, if needed, must be validated locally and shipped through the existing CI/CD process.
- Existing unrelated onboarding and question-engine working-tree edits must be preserved.
- The final implementation must cover redemption concurrency and retry safety, subscription lifecycle handling, and trustworthy server-confirmed analytics outcomes.

## Operating the feature

In AdminWeb, open **Settings → UCAT billing → Founder offers**. Choose access weeks/calendar months (up to 24 weeks or 23 months, within Stripe’s 730-day trial limit) or an ongoing percentage, a campaign label, a code, an optional use cap and an optional redemption deadline. Copy the invitation link for personal distribution. Disabling a code prevents new claims; existing benefits and already reserved checkouts remain valid. Offer terms cannot be edited after creation. Use separate codes within a shared campaign to compare distribution sources.

Existing subscribers are ineligible. New founder free periods begin on successful Stripe checkout, require a saved payment card and renew into the selected paid plan automatically unless cancelled. Stripe owns the exact trial end and subscription access. An abandoned checkout grants no access and releases its capped reservation on confirmed expiry. A former subscriber may claim a free period only if they have not already consumed a standard trial or referral acquisition gift. Historical no-card grants remain independent until their original expiry.

## Analytics contract

- `invitation_previewed`: browser observation, with `offer_id`, `offer_code`, `offer_kind`, `offer_campaign` for founder offers. It does not count as a redemption.
- `founder_discount_selected`: browser selection before checkout; does not count as a redemption or payment.
- `founder_offer_redeemed`: Stripe-confirmed free-period or discounted subscription, with stable deduplication, `redemption_id`, offer identity/campaign and benefit kind. Access grants also carry `access_ends_at`.
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


## Sandbox end-to-end verification (2026-09-21 Adelaide)

Tested Chrome against isolated local app servers, local Supabase and the development Stripe sandbox. No live payment was made.

- Created a capped offer in AdminWeb; copied its invitation link; disabled and re-enabled it.
- Accepted a two-week pass without a card. Unlimited access and the expiry date appeared; no Stripe subscription was created.
- Purchased the monthly plan with a 20% founder discount using Stripe's test card: A$32 paid against the A$40 plan, an ongoing coupon, and no additional trial after the pass.
- Fixed confirmation animation getting stuck when a pass already grants Unlimited (React Strict Mode/effect restart), and public pricing configuration being statically cached.
- Fixed invoice webhook ordering: an invoice delivered before customer mapping now returns a retryable error; delivery after mapping records the paid invoice; duplicate delivery is ignored.
- Fixed subscription billing to show the founder-adjusted next bill and Stripe's authoritative invoice total. Chrome displayed A$32 for both, with the 20% benefit explained. Practice rewards can further reduce the monthly bill to A$10 under the tested configuration.
- Existing subscribers were redirected away from a second checkout. Canceled the sandbox subscription and verified the same student cannot reclaim the founder discount.
- Queried development PostHog: invitation preview, discount selection and pass redemption arrived with campaign `sandbox-e2e-20260920`; actual successful-payment and cancellation events include both pass and discount codes. Payment/cancellation fixtures are marked `internal_test`.
- Removed the temporary local webhook secret file and stopped the extra test servers/listener. The sandbox subscription is canceled.

Development deployment `35517150864` passed lint, types, unit tests, builds, browser/database and migration/function deployment. The founder tables are present in development. Both Stripe environments already subscribe to checkout expiry/completion and subscription/invoice events. Both Supabase environments have Stripe and PostHog secret names configured (values were not disclosed or changed).

Remaining release work: deploy the E2E fixes through the release gate, then smoke-test the deployed application before promoting to production. No manual Stripe coupons are necessary. AdminWeb's `NEXT_PUBLIC_UCAT_WEB_URL` must point at the corresponding UCAT site if overriding the production default. The development yearly plan is disabled; enable it in billing configuration only if offering yearly subscriptions is intended. No production offers were created.


Final local validation: all 21 lint, typecheck and unit-test tasks passed; UCAT's 236 test suites / 1,131 tests and coverage passed; all 74 Edge Function tests (267 steps) passed. The full script encountered a shared `.next` build-directory collision, then the isolated UCAT production build passed (the other 13 build tasks had passed). All 118 database files / 1,117 tests passed after removing the manual sandbox fixtures and correcting the class schedule test to use its Adelaide timezone. All six critical browser journeys passed, plus the separate three-test founder/subscription suite. The one-command gate was not rerun end-to-end; its remaining checks were completed separately without resetting the shared database.


## Deployed development verification (2026-09-21 Adelaide)

Verified revision `be962d4f906e02caed6d499f7ed2a5266d0402cd`, including founder fix `97f37c694`. [Development CI and Supabase deployment passed](https://github.com/Altitutor/altitutor-monorepo/actions/runs/35518846276). That run skipped the unchanged browser/database job; the preceding timezone-fix revision passed that CI job, and the founder revision also passed the local critical browser/database checks recorded above.

The development web aliases were initially serving week-old builds. Built both apps from the exact pushed Git commit and updated only their development aliases:

- UCAT deployment `dpl_2YjxMMzfGQM8Q44mJHGMQ9gt9aja` → `https://ucat.development.altitutor.com`.
- Admin deployment `dpl_4Wza7hPYjUJdgiwYfDcGMUBGPbcm` → `https://admin.development.altitutor.com`.
- Configured AdminWeb's previously missing `NEXT_PUBLIC_UCAT_WEB_URL=https://ucat.development.altitutor.com` for Preview / develop only, then rebuilt AdminWeb. Production retains the correct built-in production default.

Chrome smoke test used an isolated development account classified `internal_test` and campaign `release-smoke-20260921`:

- Admin created a two-week, single-use pass and an unlimited-use 20% subscription code.
- Fresh student completed onboarding; the pass granted Unlimited until 5 October without a card or Stripe subscription.
- Student purchased monthly Unlimited with the founder code using Stripe's 4242 test card. Subscription `sub_1UHmjKKMw7XacevsDQ2KVX22` was active, test-mode, had no additional trial, and its recurring discount had no end date.
- Invoice `in_1UHmjJKMw7XacevsTupKaQuh` was paid for 3200 cents. Both invoice and next bill showed A$32 in the deployed app; the success transition reached the dashboard.
- Admin showed 1/1 pass redemptions and 1/unlimited discount redemptions.
- Development PostHog received one pass redemption, one discount redemption, one subscription start and one A$32 payment, with both founder cohort codes attached to the payment and the account marked internal_test.
- Canceled the sandbox subscription. The deployed cancellation webhook updated the subscription and PostHog. Attempting to reuse the discount was rejected before a second payment could start.
- All seven corresponding Stripe event types were processed successfully, including checkout completion, invoice payment and subscription deletion.
- Both test codes were disabled and the sandbox subscription canceled. Test history remains in development for audit; the temporary credential file was removed. No production users, payments, offers or deployments were changed.

Readiness: no remaining founder-feature blockers found. Promote the tested revision through the normal production CI/CD gate, then perform the usual post-deployment production smoke check. No manual Stripe coupon creation or new Stripe/PostHog credentials are required.

## Signup-aligned invitation links (2026-09-21)

New admin links use `/signup?offer=F-CODE` with the existing campaign parameters. The offer travels in the signup return intent through email verification, profile onboarding and the sampler. At the final step, “Your gift is ready” offers explicit acceptance or “Continue with Free”. Free-access gifts still require no payment card; discount gifts continue to plan selection and checkout. Declining does not consume a redemption and clears the pending checkout code.

Previously distributed `/invite/CODE` links redirect to signup, preserving campaign parameters; there is no separate invitation screen. Existing onboarded Free users go to the subscription page with their invitation, and existing subscriber eligibility rules remain unchanged.

This follow-up changes the previously tested revision and needs deployment through the normal gate before it is available on development or production.

Local validation for this follow-up: UCAT production build passed; UCAT lint and UCAT/admin typechecks passed; 239 UCAT unit suites / 1,146 tests passed, plus two return-intent tests added afterwards. Three browser journeys passed against local Supabase: existing Free-user pass claim, onboarding → sampler → accept gift, and onboarding → sampler → Continue with Free (zero redemptions). OTP return metadata is covered by a component test; the browser journeys use a seeded authenticated account rather than delivering a new email. No remote deployment was made for this follow-up.

## Unified card-backed code redemption (2026-09-21)

The code field sits immediately below payment details without its own background card. The right column identifies the applied offer and shows the original price struck through beside the adjusted due-today amount, with the free-period end and subsequent billing amount. Free periods use Stripe subscription trials with mandatory card collection; percentages use recurring Stripe coupons. Applying another code safely expires the old checkout before preparing its replacement. A referral code is resolved and attributed server-side, using the existing referral gift record.

The new migration permits reserved/expired free-time redemptions and removes their independent entitlement fallback once tied to Stripe. Webhook completion stores Stripe’s trial end and consumes the one-time trial; PostHog uses founder-access attribution for free-time offers and founder-discount attribution for percentage offers. No remote database changes are made manually.

Validation for the unified-code follow-up: 240 UCAT unit suites / 1,157 tests passed; shared offer validation passed (10 tests); all Edge Function contracts passed (76 tests, 267 steps); founder database contracts passed (39 tests). Three browser journeys passed for checkout code application and zero-due summary, post-sampler acceptance continuing to checkout without premature redemption, and declining without redemption. Browser tests stub Stripe session creation; route contracts verify Stripe parameters, and webhook/database tests verify completion and expiry. A new end-to-end sandbox payment for this changed billing policy remains a development smoke check after coordinated deployment. Local schema reset, UCAT fixture seeding and type generation completed; no remote schema or billing changes were made.

Final review also covered repeat checking of a capped code: its authenticated reservation owner can preview it again, including after new claims are disabled. Four additional API tests passed. UCAT production build, lint, UCAT/admin typechecks and shared offer build passed. This validation does not replace the pending deployed Stripe sandbox smoke test for the new card-backed free-period policy.

Commit gate (2026-09-21): `pnpm checkall` passed release-gate/email checks and UCAT web lint, then stopped on unrelated unused-import warnings in the concurrently edited mobile `exam-start.tsx` and `trainer-menu.tsx`. Admin web lint passed separately. The affected-feature validation above remains green; the whole-repository gate is not green for this checkout.
