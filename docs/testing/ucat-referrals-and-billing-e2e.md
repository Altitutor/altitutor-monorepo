# UCAT referrals and Accountability Pricing E2E runbook

Use this runbook in the Altitutor development environment with Stripe in test mode. Do not use real card details or run renewal tests against production.

## Prerequisites

- Migrations through `20260712075819_grant_ucat_free_referral_resets_on_signup.sql` are applied to the environment under test.
- The current `stripe-webhooks` Edge Function is deployed and its signing secret matches the Stripe test-mode webhook endpoint.
- Weekly and monthly Stripe Price IDs match `ucat_plan_prices`; yearly checkout remains disabled.
- Keep Stripe test-mode Events and the Supabase logs open during paid-flow tests.

Create four fresh plus-addressed accounts:

| Account | Purpose                     | Starting state                                                           |
| ------- | --------------------------- | ------------------------------------------------------------------------ |
| A       | Referrer                    | Free initially; later give it a paid plan for card-deduplication testing |
| B       | Free referral               | New account opened through A's link                                      |
| C       | Valid paid referral         | New account opened through A's link; uses a different test card          |
| D       | Rejected paid self-referral | New account opened through A's link; uses the same test card as A        |

Use ordinary card entry rather than Apple Pay or Google Pay for fingerprint tests because wallet tokenisation can produce a different Stripe fingerprint.

## 1. Referral page and attribution

- [ ] Sign in as A and open `/settings/plan/referrals`.
- [ ] The page loads without `Student profile not found` or a 404 from `/api/ucat/referrals`.
- [ ] Copy A's referral link, refresh the page, and confirm the code is stable.
- [ ] Open A's link in a clean signed-out/incognito session and register B.
- [ ] Complete email verification and the full UCAT signup/profile flow.
- [ ] A's **Friends joined** count becomes 1.
- [ ] Refreshing or replaying signup completion does not create a second attribution.
- [ ] Direct signup without a referral link works and creates no referral.
- [ ] An invalid referral code does not block signup and creates no attribution.

## 2. Free referral reward

Immediately after B completes signup:

- [ ] A's **Free referrals** count increases by 1 without B practising.
- [ ] A and B each receive exactly one explicit-use Free quota reset with a 30-day expiry.
- [ ] Replaying signup completion creates neither another referral nor additional resets.
- [ ] B's later question activity does not create additional resets.
- [ ] Use B's reset and confirm it only resets B's Free quota boundary, not A's.

## 3. Valid paid referral

First give A a paid test subscription and record the test card used. Then register C through A's referral link.

- [ ] C selects an eligible weekly or monthly Unlimited/Pro trial.
- [ ] C supplies a different Stripe test card from A.
- [ ] Checkout completes and the normal seven-day trial begins; referral logic does not extend the trial.
- [ ] A's **Paid-plan trials** count increases by 1.
- [ ] A and C each receive one queued free-bill reward immediately.
- [ ] If A is Free at qualification time, its reward remains queued and is available after A later subscribes.
- [ ] Replaying `checkout.session.completed` or `setup_intent.succeeded` creates no duplicate rewards.

## 4. Paid self-referral rejection

Register D through A's referral link and enter the same non-wallet Stripe test card used by A.

- [ ] D's ordinary trial/checkout still works.
- [ ] The referral is rejected with `same_payment_fingerprint` (or `same_stripe_customer` where applicable).
- [ ] Neither A nor D receives a free-bill reward.
- [ ] A's valid referral statistics exclude the rejected referral.

This is a casual-abuse control, not identity verification. Do not expect wallet-tokenised cards or determined multi-person abuse to be perfectly linked.

## 5. Free-bill redemption

Use Stripe test mode to end a trial or advance a test subscription to its next renewal.

- [ ] On `invoice.created`, at most one queued reward moves to `applied` and the invoice receives the stable 100%-off referral coupon.
- [ ] The weekly subscriber's next weekly bill is free; the monthly subscriber's next monthly bill is free.
- [ ] On `invoice.paid`, the reward moves from `applied` to `redeemed`.
- [ ] Two successful referrals produce two queued rewards consumed on two separate future renewals, not both on one invoice.
- [ ] Duplicate delivery of the same `invoice.created` event does not consume another reward or add the coupon twice.
- [ ] Voiding or marking a rewarded invoice uncollectible re-queues the reward.
- [ ] Cancelling and later resubscribing preserves a queued referral reward because rewards belong to the student, not one subscription.
- [ ] A reward on UCAT Pro makes the whole renewal invoice free, including the Pro premium.
- [ ] When a free-bill reward and earned practice credits meet on the same renewal, Stripe charges A$0, does not issue cash or create a negative invoice, and consumes only one referral reward.

## 6. Accountability Pricing

Run these separately for weekly and monthly Unlimited. Repeat a representative case on Pro.

- [ ] Viewing questions without answering does not count.
- [ ] Unanswered submitted/timed-out questions do not count.
- [ ] Nine answered questions in one student-local calendar day earn no discount.
- [ ] The tenth answered question grants exactly A$1 once for that day.
- [ ] Further answers that day do not grant another daily discount.
- [ ] Weekly progress caps at five qualifying days and cannot reduce A$15 below A$10.
- [ ] Monthly progress caps at 22 qualifying days and cannot reduce A$40 below A$18.
- [ ] The earning period follows the Stripe billing period while each qualifying day follows the student's timezone.
- [ ] A day around local midnight is assigned to the correct local date.
- [ ] Discounts earned during a trial reduce the first paid invoice.
- [ ] Pending practice credits are forfeited when paid access actually terminates.
- [ ] Unlimited and Pro earn the same A$1 daily discount; Pro retains its fixed premium.
- [ ] The billing interval cannot be switched after paid checkout/trial start.
- [ ] Yearly is absent from checkout and cannot be selected by directly editing the URL/request.

## 7. Checkout and failure handling

- [ ] Advertised and Stripe amounts match before checkout is allowed.
- [ ] A stale/mismatched Stripe Price fails closed with the pricing-update message rather than charging the old amount.
- [ ] An account with an existing active/trialling UCAT subscription cannot create a duplicate checkout.
- [ ] Trial eligibility is consumed once and is not restored by cancellation or another account action.
- [ ] Failed or abandoned Checkout Sessions do not grant a paid referral reward.
- [ ] A delayed `setup_intent.succeeded` event can complete a referral that was pending because the fingerprint was not yet available.
- [ ] Webhook retries remain idempotent and `stripe_webhook_events` records processing failures for investigation.
- [ ] Complete the dedicated failed-billing lifecycle in `docs/testing/ucat-failed-billing-launch.md` for both weekly and monthly subscriptions.

## Read-only verification queries

Replace the placeholder emails only. These queries inspect state; they do not modify it.

```sql
select id, user_id, email, status
from public.students
where email in ('referrer@example.com', 'referred@example.com');

select
  r.id,
  referrer.email as referrer_email,
  referred.email as referred_email,
  r.free_qualified_at,
  r.paid_qualified_at,
  r.rejected_at,
  r.rejection_reason
from public.ucat_referrals r
join public.students referrer on referrer.id = r.referrer_student_id
join public.students referred on referred.id = r.referred_student_id
where referrer.email = 'referrer@example.com';

select student_id, grant_source, referral_id, expires_at, used_at
from public.ucat_free_quota_reset_entitlements
where referral_id is not null
order by created_at desc;

select student_id, referral_id, status, stripe_subscription_id,
       stripe_invoice_id, applied_at, redeemed_at
from public.ucat_referral_bill_rewards
order by created_at desc;
```

## Launch-signoff minimum

Before launch, complete at least:

1. Referral page/profile resolution.
2. One valid Free referral plus signup-replay idempotency controls.
3. One valid paid referral with different cards.
4. One rejected same-card referral.
5. One real Stripe test renewal that redeems a free bill.
6. One weekly and one monthly tenth-question discount grant.
7. Price-mismatch fail-closed and duplicate-webhook checks.
8. One failed-renewal recovery and one exhausted-retry downgrade using Stripe Test Clocks.

The immediate Free-referral reward will not exist in a shared development environment until the migration above is applied there. Applying it is a database write, so deploy it deliberately before starting the shared-environment tests.
