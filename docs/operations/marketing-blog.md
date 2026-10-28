# Marketing blog publishing

One hub at `/blog/`, with stable `/blog/[slug]/` URLs and Guides / Product updates categories. There is no CMS, independent category archive or publication schedule.

## Add an article

1. Write trusted MDX in `apps/marketing-web/src/content/blog/`. Use the draft `authoring-example.mdx` as a formatting reference; it is not public content.
2. Import its default component explicitly in `src/features/blog/articles.ts` and add its metadata to the catalogue: unique kebab-case slug, title, description, named author (set `authorType: "Organization"` for an organizational byline; default is `Person`), category (`guide` or `product-update`), status (`draft` or `published`), and `conversionTarget` (`trial-session` or `ucat-signup`). Choose the relevant next step based on the article, independently of its category.
3. Review claims, source links, dates and any permissions. Review in a local branch with fixture metadata temporarily set to published; revert fixture publication before committing. Public draft preview is deliberately not provided. A branch deployment exposing a draft as published must be protected; noindex is not access control.
4. To publish reviewed material, set `status: "published"` and a real `publishedAt` date in `YYYY-MM-DD` format. Set `updatedAt` only for substantive later changes. Metadata validation runs at import/build time. Published items automatically enter routes, hub and sitemap.
5. Run marketing-web lint, typecheck, tests and build, inspect desktop/mobile and then use the repository's normal review/deploy process. Publishing requires a deployment.

The catalogue is the single publication boundary. Drafts and unknown slugs return 404 and never enter public listings or sitemap. With no published content, the hub shows an honest empty state. Do not publish the layout fixture.

## Downloads

MDX can import `DownloadResources` from `@/features/blog/download-resources` and supply `resources` with `title`, `publisher`, `href` (file URL), `sourceUrl` (publisher/source page), optional `year`, `format` and `note`. Links must be HTTPS or site-relative paths. The component labels provenance; it does not establish permission. External sources can be linked directly. Only add third-party PDFs under a public download path after permission is confirmed. Clearly identify historical years, missing years and limits of interpretation. No SATAC documents are included in this change.

Keep a permanent course page authoritative for dates, enrolment and bookings. Updates link there; mark expired announcements. Prefer updating an existing evergreen article to duplicating it per year. Keep content in HTML and use client components only for useful interaction. MDX is executable code, so use trusted repository authors and reviewed imports only.

## Design and metadata

Both categories use the existing site frame and one article template. The hub groups articles by category with in-page navigation, avoiding announcements burying guides. Each published article has canonical/social metadata and BlogPosting JSON-LD. A shared generated social image is used initially. Blog discovery is included in desktop/mobile navigation and footer. Add a content service only if independent author workflows justify it.

## Conversion destinations and attribution

Every article must select a valid `conversionTarget`; the build rejects missing or unknown keys. The shared destination catalogue in `src/features/marketing/conversion-actions.ts` supplies URLs and copy for the article CTA and its navigation action. To support a future signup flow, add its configured product link and one catalogue entry; the key type and validator extend automatically. Do not add a future destination until its real flow exists. Other marketing pages retain their existing navigation actions.

The marketing analytics provider captures observed first touch on `/blog/` and article routes as well as `/ucat/`. It uses the existing cross-subdomain UCAT attribution cookie and never replaces an earlier touch. This preserves article landing paths, campaign fields and referrer evidence for UCAT signup. It does not count a CTA click as a completed signup or trial booking.
