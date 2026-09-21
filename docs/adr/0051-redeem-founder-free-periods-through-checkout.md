# Redeem founder free periods through checkout

Supersedes ADR 0050’s no-card founder-pass policy. Founder free-time codes and friend-referral codes are entered in the same checkout field and require a saved payment method; the selected plan renews automatically when the free period ends unless cancelled. The checkout states the amount due today and subsequent billing terms. Existing redeemed no-card passes retain their original terms.

Code validation reserves a capped place without granting access. Stripe checkout completion confirms redemption and subscription access; expiry releases the reservation. This replaces a separate immediate-access action with one consistent checkout decision. Percentage founder discounts retain their existing subscription-lifetime and non-stacking rules.
