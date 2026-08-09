# Centralised email presentation and message ownership

## Status

Accepted

## Decision

Altitutor uses one provider-neutral email module with explicit Altitutor and Altitutor UCAT brand profiles, taking the existing UCAT appearance as the visual compatibility baseline. Canonical content builders return a complete rendered email—including subject, preview text, HTML, plain text, sender, and reply destination—while Node and Supabase Edge delivery remain separate adapters. Shared identity emails are product-neutral and their static Supabase templates are generated from the common renderer; reusable identity, invitation, registration, booking, invoice-notification, and internal-contact content is centralised, while specialised Product-app campaign prose stays with its domain logic and uses the common renderer. Staff-authored content is an escaped introduction inside a canonical email rather than a full-body override. Stripe remains authoritative for core tutoring invoice documents, payment collection, and state, while Altitutor owns invoice notification delivery to configured Student and parent recipients; Stripe's finalised-invoice email must therefore remain disabled to prevent duplicates. Customer-facing mail uses monitored `admin@altitutor.com` or explicitly founder-authored `matt@altitutor.com` identities rather than `noreply@altitutor.com`.

Verification is part of the module: a repository-wide preview gallery covers representative light, dark, and mobile fixtures; builders are tested as complete rendered emails; generated Supabase templates are checked for drift in CI; and delivery adapters are tested without sending external email.
