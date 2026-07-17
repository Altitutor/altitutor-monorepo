# UCAT referrals: gifted Unlimited access and referrer rewards

## Context

UCAT referrals need a clear customer proposition for both Free and paid referrers without maintaining a separate generic trial. The recipient must make an explicit choice, self-referrals must remain unattractive, and multiple earned referrer rewards must not collapse onto one renewal.

## Decision

1. Every student receives one stable referral link; one student can be attributed to only one referrer and receive only one acquisition gift.
2. The referral creates a seven-day offer for one free week or month of UCAT Unlimited. Free referrers default to a week; paid weekly referrers give a week; paid monthly or yearly referrers give a month. The snapshotted duration does not change if the referrer later changes status.
3. A pending offer remains as an actionable UCAT notification. Reading it does not dismiss it. It resolves only when accepted, explicitly rejected, or expired after seven days.
4. Acceptance starts an ordinary UCAT Unlimited subscription through Stripe Checkout, collects a payment method, and makes the first matching billing period free with a once-only 100%-off coupon. Stripe `trialing` status is not used.
5. Acceptance is valid only when the recipient's Stripe customer and card fingerprint differ from the referrer's. A Free referrer then earns an independently claimable week or month of UCAT Unlimited; a paid referrer earns one queued 100%-off renewal on their existing subscription tier.
6. Explicit rejection gives the recipient one UCAT Free quota reset. It also gives the referrer one quota reset only when the referrer was Free when the gift was created. Expiry grants neither reward.
7. Multiple accepted referrals may produce multiple future referrer rewards. Paid billing rewards are applied FIFO at one per renewal; unused practice-day discounts carry to the next payable invoice rather than being erased by a free referral invoice.

## Consequences

- Referral copy consistently describes a gift from the named referrer, not a generic promotion or trial.
- Gifts always grant UCAT Unlimited. UCAT Pro human-support entitlements are never gifted, although a paid Pro referrer's next existing Pro renewal can be made free as a billing reward.
- A Free referrer can earn claimable Unlimited access before subscribing without receiving a cash-equivalent balance.
- Stripe fingerprint comparison deters casual paid self-referrals but cannot perfectly link wallet-tokenized cards to the same physical card.
- Referral terms must clearly state the seven-day acceptance window, future renewal after the free period, self-referral rejection, queueing, and non-cash nature of rewards.
