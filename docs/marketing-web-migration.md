# Marketing Web Migration

`apps/marketing-web` is the Next.js site on the root domain. The WordPress runtime, Elementor assets, and `public/wp-content` have been removed. Indexed URLs are preserved with redirects, canonicals, and the sitemap.

## What stayed on purpose

- Page titles, descriptions, and canonicals for the May 2026 Search Console priority URLs live in `src/content/pages.json`
- Old class, registration, sitemap, and `/wp-content/uploads/...` URLs redirect permanently
- Retired shop routes (`/cart/`, `/checkout/`, `/my-account/`, `/activate/`) redirect to the student trial booking flow or student sign-in
- Copy for the redesigned pages lives in `src/features/marketing/content/production.json`

## Redesign rule

Change a URL, canonical, title, H1, or the primary meta description only with an explicit replacement plan. Visual layout can change freely.
