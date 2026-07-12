# UCAT referrals: activity qualification and queued free bills

## Context

UCAT referrals need to reward genuine product use, feel more valuable than the ordinary practice-day discount, and remain simple across weekly and monthly subscriptions. Applying several once-only Stripe coupons directly when friends join would collapse multiple rewards onto the same renewal, while extending trials would interfere with the existing trial entitlement model.

## Decision

1. Every student receives one stable referral link; one new student can be attributed to only one referrer.
2. A Free referral is rewarded immediately when the referred student completes signup through the referral link. Both participants receive one explicit-use Free quota reset that expires after 30 days; no practice activity is required.
3. A paid referral qualifies when the referred student starts their eligible one-time Unlimited trial after supplying a Stripe payment method whose customer and card fingerprint differ from the referrer's. Both participants receive one free-bill entitlement immediately.
4. Free-bill entitlements are queued in Altitutor, including for UCAT Free students. At each weekly or monthly renewal, the webhook applies at most one queued entitlement as a 100%-off invoice coupon, then marks it redeemed only when that invoice is paid.
5. Multiple successful referrals produce multiple future free bills. Voided or uncollectible invoices return the associated entitlement to the queue.
6. The free-bill reward covers the whole renewal invoice, including UCAT Pro's fixed premium. Earned rewards are honoured even if referral terms change later.

## Consequences

- Weekly subscribers receive one free weekly bill; monthly subscribers receive one free monthly bill. The interval difference is visible after signup rather than used as public acquisition copy.
- The existing seven-day trial remains unchanged, and UCAT Pro human-support entitlements remain inactive while the referred subscription is trialing.
- A Free referrer can earn rewards before subscribing without receiving a cash-equivalent balance.
- Stripe fingerprint comparison deters casual paid self-referrals but cannot perfectly link wallet-tokenized cards to the same physical card.
- Unlimited has a low marginal delivery cost, but a free Pro bill can create real human-support cost once the trial ends. Referral-cohort conversion, support use, and Pro capacity should be reviewed before increasing the reward further.
- Referral terms must clearly state the qualification event, self-referral rejection, queueing, and non-cash nature of rewards.
