# Redeem founder free periods through checkout

Supersedes ADR 0050’s no-card founder-pass policy. Founder free-time codes and friend-referral codes are entered in the same checkout field and require a saved payment method; the selected plan renews automatically when the free period ends unless cancelled. The checkout states the amount due today and subsequent billing terms. Existing redeemed no-card passes retain their original terms.

Code validation reserves a capped place without granting access. Stripe checkout completion confirms redemption and subscription access; expiry releases the reservation. This replaces a separate immediate-access action with one consistent checkout decision. Percentage founder discounts retain their existing subscription-lifetime and non-stacking rules.

Pending invitation intent is remembered in browser local storage for 30 days, starting when a signup link is opened. It survives an expired login or a lost return URL on the same browser; it is not an entitlement or a reserved redemption. The API revalidates availability and eligibility. Continuing with Free or completing checkout clears it. Cross-device recovery requires reopening the invitation link.

Checking a code on a plan-selection surface opens the gift preview before acceptance. Checking a code inside checkout replaces the checkout offer directly. The checkout purchase action remains disabled until Stripe's Payment Element reports ready, and confirmation failures are caught for both card and express payment paths.
