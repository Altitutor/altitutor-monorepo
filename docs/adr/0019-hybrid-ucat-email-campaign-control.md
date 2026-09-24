# Hybrid UCAT email campaign control

## Status

Accepted

## Decision

Altitutor owns behavioural UCAT email orchestration in Supabase, including consent, eligibility, priority, cooldowns, deduplication, experiments, and the auditable send record. Resend is the delivery provider and the authoring and scheduling surface for product-news broadcasts; PostHog is the effectiveness-analysis surface. A focused `admin-web` campaign control centre provides operational status, pause controls, previews, volume summaries, and links into PostHog and Resend.

This boundary keeps student-specific business rules beside canonical product data without rebuilding specialist deliverability or product-analytics tools. Campaign copy remains code-reviewed initially rather than introducing a database-backed content editor.
