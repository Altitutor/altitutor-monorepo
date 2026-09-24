# Separate founder access passes from subscription billing

Free-pass policy superseded by [ADR 0051](0051-redeem-founder-free-periods-through-checkout.md).

Founder access passes are expiring UCAT Unlimited entitlements with no card requirement and no automatic conversion to paid billing. Founder percentage discounts belong to a single Stripe subscription and are lost when it ends; they cannot be applied to existing subscriptions or reclaimed on resubscription. Keeping the free pass outside Stripe makes the promised explicit later purchase independent of trial renewal behaviour.

Admin-issued codes and friend referrals share an entry flow, while existing card-required friend gifts retain their own terms. One student may claim one founder pass; access passes do not chain with standard trials or referral acquisition gifts. A pass recipient may use a founder discount on their subsequent paid purchase. Earned practice discounts and referral billing rewards remain available alongside the percentage discount. Billing intervals remain locked under ADR 0003.

Redemptions and open checkout reservations are serialized in Postgres. Stripe owns subscription discounts and confirms completed/expired checkouts; a reservation is not a paid conversion. First-touch acquisition attribution remains distinct from founder campaign attribution.
