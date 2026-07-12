# UCAT failed billing launch and E2E runbook

## Stripe test-mode configuration

Before launch, mirror these settings in Stripe test mode and then live mode:

- Billing → Revenue recovery → Retries: enable Smart Retries, use approximately three retries within a maximum five-day window, and choose **cancel the subscription** after the final attempt.
- Billing → Revenue recovery → Customer emails: enable failed card-payment emails, payment-confirmation/3D Secure emails, and expiring-card emails.
- Do not enable generic upcoming-renewal email globally while weekly plans are offered.
- Customer portal: allow payment-method updates, invoice viewing/payment, and cancellation; verify Altitutor branding and return URLs.
- Webhook endpoint: subscribe to `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.paid`, `invoice.updated`, `invoice.finalization_failed`, `invoice.finalized`, `customer.subscription.updated`, and `customer.subscription.deleted`.

Stripe Dashboard recovery configuration is not available as application code. Record screenshots of the test and live settings during launch sign-off.

## Access lifecycle

- [ ] A successful initial Checkout or `trialing` subscription grants the selected entitlement; an incomplete initial payment does not.
- [ ] The first failed renewal changes Stripe/local status to `past_due` while Unlimited/Pro access and practice-discount earning continue.
- [ ] The student sees the global **Payment needs attention** pill and the subscription-page recovery panel.
- [ ] The recovery action opens the affected hosted invoice when available, otherwise the Stripe customer portal.
- [ ] The panel distinguishes card/payment-method failure from authentication required.
- [ ] The next retry time appears when Stripe provides `next_payment_attempt` and disappears when it does not.
- [ ] Updating the payment method and paying the invoice returns the subscription to `active` without losing progress or earned discounts.
- [ ] Exhausting retries cancels the subscription, moves access to Free, forfeits only still-pending practice credits, and preserves account/history/results.
- [ ] Defensive fallback: manually transition a test subscription to `unpaid`; it remains manageable but grants no paid entitlement.
- [ ] A normal voluntary cancellation does not send the failed-billing terminal email.

## Communication and idempotency

- [ ] Stripe sends its configured failed-payment/authentication email with a working hosted recovery link.
- [ ] Altitutor creates one active recovery notification per invoice, even across retry attempts and webhook redelivery.
- [ ] Successful payment resolves that recovery notification and creates one success notice, but no duplicate custom recovery email.
- [ ] Failed-billing termination creates one Altitutor email; duplicate `updated`/`deleted` events do not send it twice.
- [ ] Raw Stripe decline text is not shown to the student; only safe action-oriented copy appears.

## Operations

- [ ] Webhook signature failures and unprocessed `stripe_webhook_events` are monitored.
- [ ] Support can see the Stripe invoice, failure code, retry status, and subscription state without seeing full card details.
- [ ] Track payment-failure rate, recovery rate, time to recovery, and involuntary cancellations separately for weekly and monthly plans.
- [ ] Use Stripe Test Clocks to exercise at least one weekly and one monthly renewal through failure, recovery, and exhausted retries.
