# Marketing blog: SEO value in the AI-search era

Date: 25 September 2026  
Scope: whether Altitutor should invest in an editorial content library on `marketing-web`.  
Method: current Google documentation plus original empirical research. Recommendations are applied judgement; none of the studies establishes Australian tutoring acquisition ROI.

## Recommendation

**Yes, pilot a small library of useful, expert-authored guides, provided someone owns the content and keeps it accurate.** Treat it as a way to demonstrate teaching expertise, help prospective families, and attract relevant enquiries. Do not budget on the assumption that publishing many generic articles will reliably produce large organic traffic gains.

The evidence supports two simultaneous conclusions: AI search reduces some outbound clicks, while Google continues to retrieve and recommend useful pages. It does not show that having a blog is itself a ranking advantage, nor that blogs are categorically obsolete. The relevant distinction is the value of each resource and its audience, rather than whether the navigation label says “Blog” or “Guides”. This recommendation is an inference from the findings below, not a measured forecast for Altitutor.

## What the evidence says

### 1. Google's current advice strongly favours the approach the user wants

Google's AI optimization guide, updated **10 July 2026**, says AI search still relies on its search index and ranking systems. It specifically recommends original expertise and experience, useful structure, and relevant images/video. It warns against recycled information and generating a page for every possible query variation. Google says `llms.txt`, special AI markup, arbitrary content chunking, and inauthentic mentions are unnecessary for Google visibility. This is platform guidance about eligibility and quality, not independent evidence of business returns. [Google's AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)

Google's separate content guidance recommends original analysis, clear sourcing, identifiable authors and demonstrable expertise. AI can assist research and structure, but mass generation without added value may violate scaled-content-abuse rules. The concern is usefulness and originality; AI assistance is not automatically disqualifying. [People-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [generative AI content guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)

### 2. Click pressure is real, but widely repeated numbers need context

| Original source | Observed finding | What it cannot establish |
| --- | --- | --- |
| [Pew Research Center, 22 July 2025](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/) | Among 900 US adults' browsing in March 2025, traditional-result clicks occurred on 8% of visits classified as having an AI summary versus 15% without one; summary-source clicks occurred on 1% of AI-summary visits. | This was observational. Search results were reconstructed in April, after the browsing period; query types differ. The numbers are neither a controlled causal estimate nor an Australian tutoring forecast. |
| [Ahrefs, 4 February 2026](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) | A 300,000-keyword study compared aggregated desktop Search Console CTR in December 2023 and December 2025. It estimated 58% lower position-one CTR for AI Overview queries after adjusting using the decline in a non-AI informational-query comparison group. | This is an observational vendor study, dependent on sampling and comparison assumptions. “58%” is not the loss for every site, every query, mobile search, or total organic traffic. |
| [Wang et al., preprint submitted 18 August 2026](https://arxiv.org/abs/2608.18352) | A preregistered field experiment with 1,100 US adults found that removing Google's AI features increased external click-through by 8.8 percentage points; forcing AI Mode reduced it by 18.8 points relative to standard Google Search. | This is a recent preprint, with a short study period and a US adult browser sample. Forced AI Mode differs from voluntary adoption. It does not estimate long-term Australian education lead generation. |

The experimental result strengthens the case that the click reduction is more than correlation, while still leaving substantial uncertainty about individual businesses. [Full experimental paper](https://arxiv.org/html/2608.18352v1)

### 3. Visibility is not the same as visits or customers

Google says a page needs to be indexed and eligible for a search snippet to appear as a supporting link in AI features; indexing or display is never guaranteed. Crawlable internal links, visible text and a good user experience still matter. [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

There is an important documentation-date distinction: the December 2025 AI-features page describes combined Web reporting, whereas Google announced dedicated **Generative AI performance reports on 3 June 2026**, with worldwide rollout noted as complete on 31 August. These report impressions and page/country/device/date breakdowns; the announcement does not promise separate AI clicks or conversion attribution. Track these visibility signals alongside ordinary Search Console and on-site conversion data. [Google reporting announcement](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)

## Content strategy for Altitutor — applied judgement

Prioritise important service/course pages first if their targeting, evidence, internal links or conversion paths remain incomplete. A guide should help an audience that could reasonably use Altitutor, then link naturally to the relevant next step.

Useful candidate resources include:

- A tutor's annotated worked example showing a common SACE Maths or Chemistry mistake, why it happens, and how to correct it.
- A realistic study plan for a specific student situation, with an editable planner and an explanation of how to adapt it.
- A parent guide to interpreting a disappointing assessment and deciding whether the student needs help with concepts, technique or study habits.
- A UCAT mock-review walkthrough built around an original example, with a reusable error-analysis worksheet.
- A carefully maintained local curriculum or exam guide that adds tutor interpretation to cited official requirements.

These are stronger starting points than generic “ten study tips” because the author can contribute classroom experience, worked reasoning and reusable materials. This does not make them immune to AI summarisation. The goal is to give readers a reason to visit, use, save or share the full resource.

Each guide should have a named author or reviewer with relevant credentials, original examples, primary-source links for factual requirements, a truthful publication/update date, and a useful next action. Use AI to organise interview notes, edit drafts, and implement visual examples; require the subject expert to own factual claims and teaching advice. Avoid unsupported outcome claims or invented student stories. Maintain existing guides when facts change rather than manufacturing publication frequency.

## Bounded pilot — applied judgement, not an SEO guarantee

1. Start with **six to eight substantial guides over approximately three months**, selected from recurring real student/parent questions and Search Console opportunities. This is a manageable editorial experiment, not a ranking requirement.
2. Before publishing, record current organic landing-page traffic, relevant queries, enquiries/signups, and enquiry-to-customer conversion where available.
3. Ensure every guide is linked from a relevant service page or topic index, and links back where helpful. Repurpose original worked examples into useful tutor videos or student handouts so the effort has value beyond search.
4. Review at three months for indexing, query relevance and early engagement; reassess after six months with exam-season timing in mind. Distinguish “not indexed”, “not ranking”, “ranking but not clicked” and “visited but not converting”. They need different fixes.
5. Continue based on qualified enquiries, assisted conversions, signups and usefulness to current students. Use impressions and rankings as diagnostic signals, not the commercial objective.

A simple commercial check is whether the estimated contribution from attributable additional customers exceeds writing, expert review, development and maintenance costs. No site analytics were analysed for this research, so a numeric ROI or traffic forecast would be speculative.

## Publishing architecture for marketing-web

Recommendation after the owner confirmed they will write/publish with Codex or developer help: use repository-owned MDX, rendered by the existing Next.js app. This is an architectural judgement for this workflow, not a claim that MDX ranks better than a CMS.

### Repository findings

Inspected on 25 September 2026; these are working-tree observations, not a production crawl:

- `apps/marketing-web/package.json` uses Next.js 14.2.35 and React 18. There is no MDX dependency configured yet.
- `src/content/wordpress-pages.json` and `src/lib/wordpress.ts` serve imported content; this is not a live WordPress authoring backend.
- `src/app/[[...slug]]/page.tsx` generates legacy pages and metadata. Keep new editorial routes separate from this import path.
- `src/app/sitemap.ts`, `src/app/robots.ts`, and `next.config.js` already provide a sitemap, robots rules, trailing-slash URLs, redirects and preview-host noindex headers.
- The current resources page concerns online SACE/IB products. Prefer a new `/guides/` index and `/guides/[slug]/` routes, avoiding repurposing an existing product URL.
- `docs/marketing-web-migration.md` records a May 2026 Search Console export with existing commercial pages among the highest-traffic URLs. It is historical context, not a fresh traffic analysis.

### Options

| Approach | Fit | Main trade-off |
| --- | --- | --- |
| Repo Markdown/MDX | Recommended for owner plus Codex/developer | Publishing requires a reviewed change and deployment; no independent visual editing |
| Git-backed editor | Consider if simple browser editing becomes necessary | Adds editor/auth/preview configuration while preserving files |
| Headless CMS | Consider when several nontechnical authors need roles, approvals, scheduling and media management | Adds a content service, schema, authenticated previews and cache invalidation |
| Custom database/admin blog | Poor starting fit | Would require building the editorial workflow for little initial benefit |

The storage choice itself does not create SEO value; the rendered content, crawlability, links and user experience are the relevant outputs. No CMS vendor is selected here because the confirmed publishing workflow does not need one.

### Minimal implementation design

- Store articles in `apps/marketing-web/src/content/guides/`; keep the renderer, article catalogue and reusable presentation under `src/features/guides/`.
- Use explicit imports/a small manifest initially, with a single article catalogue consumed by the index, route generation, metadata and sitemap. No speculative multi-provider abstraction.
- Compile trusted repository MDX using `@next/mdx` compatible with the installed Next.js version; use the App Router's required `mdx-components.tsx`. MDX supports ordinary prose plus React components for worked examples, diagrams or small interactive exercises. Plain Markdown is sufficient if articles never need components.
- Use validated article data: stable slug, title, description, author, published date, genuinely modified date, topic, publication status and optional image. Keep metadata in a typed catalogue or explicitly configure frontmatter; `@next/mdx` does not parse YAML frontmatter automatically.
- Render published articles to HTML at build time. Keep the substantive answer in HTML; hydrate only interactive elements. Include only published articles in static routes, listings, related links and the sitemap; unpublished URLs must not expose drafts.
- Reuse the marketing site frame. Supply canonical URLs, social metadata, descriptive links, readable headings and appropriate images. Use accurate Article/BlogPosting data that matches the visible author and dates. Structured data helps interpretation; it does not guarantee rankings or a special search appearance.
- Keep drafts on a branch and use a protected preview deployment for review. Preview noindex headers are useful but are not access control.
- Publishing flow: tutor/owner notes → draft → factual/editorial review → preview → merge/deploy. AI can help structure, copy-edit and format; a named human owns the claims and examples.
- Avoid article-specific arbitrary layouts, comments, site search and thin tag/date archives at launch. Add an organised topic index as the library grows.
- Retain stable slugs if storage changes later. A future CMS can feed the same article presentation and metadata contract; React-heavy MDX embeds would need explicit mapping into CMS blocks, so migration is not cost-free.
- MDX is executable code. Keep it in the trusted review/deployment path; if nontechnical or external authors later need rich text, use constrained content blocks rather than executing arbitrary submitted MDX.

Technical references: [Next.js 14 MDX documentation](https://nextjs.org/docs/14/app/building-your-application/configuring/mdx), [Next.js 14 draft previews](https://nextjs.org/docs/14/app/building-your-application/configuring/draft-mode), [Google Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).

For the pilot above, start with one subject cluster rather than spreading a handful of articles across all offerings. Confirm cross-subdomain conversion measurement where consent/settings permit. The limiting input is useful tutor expertise and sustained review time, not the publishing software.
