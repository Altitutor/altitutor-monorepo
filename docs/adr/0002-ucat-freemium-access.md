# UCAT Freemium Online Access

UCAT online access moves from a binary gate (subscription or manual grant required to enter product areas) to a freemium model: **UCAT Free** is the default for every signed-up student, with independent per-area usage quotas, while **UCAT Pro** (paid subscription, Pro trial, or admin Force Pro override) grants unlimited access. In-person class access remains an orthogonal add-on.

This replaces route-level blocking and the "Unlock online UCAT access" modal with in-context quota enforcement at action time (question submit, set/mock start) and area-specific upsell modals. Quotas are configured per area (limit + day/week/month period) in admin settings; a limit of zero disables that area for Free students.

Pro trial is offered once per account (consumed when Stripe creates a `trialing` subscription). Trial expiry or cancellation downgrades to UCAT Free rather than locking the student out. Practice-day billing discounts remain Pro-only.

We chose per-area quotas over a shared pool because Learn, Practice, Sets, Mocks, and Skill trainer serve different intents and should not cannibalise each other. Server-side enforcement on write APIs was chosen over client-only or DB triggers for maintainability and clear error responses. Admin tier override (Default / Force Pro / Force Free) replaces implicit "manual grant = unlimited" with an explicit model aligned to the new tiers.
