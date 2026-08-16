# UCAT landing-page launch and indexing strategy

Date: 15 August 2026  
Scope: short-term organic-search launch of `https://altitutor.com/ucat/` while the wider `marketing-web` redesign is unfinished  
Method: current Google Search Central documentation and direct repository inspection. Recommendations about the target search intent are explicitly identified as applied judgement.

## Recommendation

**Do not defer the UCAT launch solely because the wider marketing redesign is unfinished.** Launch the existing page at `https://altitutor.com/ucat/`, keep that exact public URL through the redesign, and treat it as a self-contained landing page that is nevertheless linked from the rest of `altitutor.com`.

Google says its ranking systems work primarily at the **page level**, although site-wide signals also contribute. A single strong page can therefore be indexed and rank without waiting for a complete UCAT content hub ([Google ranking systems guide](https://developers.google.com/search/docs/appearance/ranking-systems-guide)). Indexing is only eligibility, however: it does not guarantee visibility for a competitive query.

Keep the page in the existing `altitutor.com` subdirectory. Google advises choosing subdirectories versus subdomains according to what makes sense for the business, and says keywords in a domain name or URL path alone have hardly any ranking effect ([Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)). A new subdomain or domain has no documented ranking advantage here and would add new discovery, verification, linking, and later migration work. It would also separate the product page from Altitutor's existing identity and root-domain signals.

## What is already in place

The repository already gives `/ucat/` a useful technical baseline:

- [`src/app/ucat/page.tsx`](../../apps/marketing-web/src/app/ucat/page.tsx) declares the trailing-slash canonical, an index/follow rule, a unique UCAT title and description, and Australian locale metadata.
- [`src/app/sitemap.ts`](../../apps/marketing-web/src/app/sitemap.ts) includes the canonical `/ucat/` URL.
- [`src/app/robots.ts`](../../apps/marketing-web/src/app/robots.ts) allows the page and advertises the root sitemap.
- [`docs/marketing-web-migration.md`](../marketing-web-migration.md) already establishes the intended rule: keep URLs, canonicals, search intent, and substantive copy stable through redesign work.

The important current gap is **internal discovery**. The legacy site-wide header and footer in [`src/app/[[...slug]]/page.tsx`](../../apps/marketing-web/src/app/%5B%5B...slug%5D%5D/page.tsx) link to the older in-person UCAT preparation page, but not to `/ucat/`. Google says every important page should have a link from at least one other page and that internal anchor text helps people and Google understand and find it ([Google link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)). Sitemap inclusion should supplement, not replace, links.

## Launch-week plan

### Required before or at launch

1. **Keep one canonical URL:** use `https://altitutor.com/ucat/` in the canonical tag, sitemap, and all internal links. Redirect `/ucat` to it, rather than submitting both forms. Google treats redirects and `rel="canonical"` as strong canonical signals; sitemap inclusion is weaker but complementary ([Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)).
2. **Make the root sitemap valid and submit it directly:** resolve all sitemap processing errors, verify that it contains the absolute canonical `/ucat/` URL, then submit `https://altitutor.com/sitemap.xml` in Search Console. A sitemap is useful for new URLs, but it is only a hint and cannot guarantee a crawl or indexing ([build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)). Keep `<lastmod>` values accurate rather than updating them merely to look fresh.
3. **Add normal crawlable internal links:** add `<a href="/ucat/">` links from at least the homepage and `/classes/ucatprep/`; a site navigation/footer link is also reasonable. Use descriptive, natural anchor text such as “online UCAT preparation” where it fits. These links should be present in the server-rendered mobile and desktop HTML.
4. **Inspect the exact canonical URL:** in Search Console, run the live test for `https://altitutor.com/ucat/` and request indexing once. Repeated requests do not make crawling faster ([ask Google to recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)).
5. **Verify the rendered page:** confirm `200`, self-canonical, `index,follow`, substantive visible text, working mobile layout, and no staging-only `noindex` or robots block. Google notes that content quality, robots rules, and site design can all affect indexing ([how Google Search works](https://developers.google.com/search/docs/fundamentals/how-search-works)).

### Search-intent readiness

There is no Google-mandated minimum word count, page count, or heading count. Google explicitly says content length alone does not determine ranking ([Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)). The minimum is instead a page that fully answers the prospective student's decision.

For the intended query family—“online UCAT course”, “online UCAT preparation”, and Australian/UCAT ANZ variants—the current page already covers the product, questions and mocks, study plan, guided learning, analytics, pricing, free access, testimonials, provider story, comparison, and FAQs. Applied judgement for the final launch pass:

- make “online UCAT preparation/course for Australia and New Zealand” explicit in the visible main heading or immediately adjacent introduction, not only the document title;
- make the delivery mode, target cohort/year, inclusions, Free versus Unlimited limits and prices, and signup action unambiguous;
- retain first-hand evidence: genuine student outcomes, who built/reviews the preparation, and why the product differs;
- ensure claims such as question/mock counts and competitor comparisons are current and supportable;
- answer the questions a student needs before choosing, without padding the page or repeating keywords.

This follows Google's guidance to use a clear title and heading, create a substantial and satisfying description, show first-hand expertise, and write for an intended audience rather than for search-engine manipulation ([people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [title-link guidance](https://developers.google.com/search/docs/appearance/title-link)).

`Course` structured data is **not** an indexing requirement or a launch blocker. Google's course-list result requires at least three bona fide courses and `ItemList` markup; it should not be forced onto one subscription platform unless the visible offering truly meets those rules ([Course structured data](https://developers.google.com/search/docs/appearance/structured-data/course)).

## Redesign and migration risk

The safest redesign is an in-place change at the same `/ucat/` URL. Preserve the URL, canonical, core search intent, and truthful substantive content; visual design and implementation can change. Google distinguishes infrastructure/layout changes without user-visible URL changes from URL migrations and recommends retaining crawler access and Search Console verification through the change ([changing hosting without URL changes](https://developers.google.com/search/docs/crawling-indexing/site-move-no-url-changes)).

If a later redesign must change the URL, map the old page to a genuinely equivalent new page with a server-side permanent redirect, update canonicals/internal links/sitemaps, and retain redirects for at least one year. Google warns that rankings can fluctuate while moved URLs are recrawled and reindexed, and that even a small-to-medium move may take weeks ([site moves with URL changes](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)). Avoid combining a URL move, domain move, CMS change, and major copy rewrite at once.

## Timing and expectations

Google says a requested crawl can take **a few days to a few weeks**, repeated requests do not accelerate it, and crawling, indexing, and serving are never guaranteed ([ask Google to recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [how Google Search works](https://developers.google.com/search/docs/fundamentals/how-search-works)). Google's broader SEO guidance recommends waiting at least a few weeks to assess many changes; some effects take longer ([Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)).

Therefore:

- launch-week success means the page is technically accessible, discoverable through links and the sitemap, submitted, and beginning to collect Search Console data;
- indexing within the coming week is possible but cannot be promised;
- first-page ranking for “online UCAT courses” by launch week is not a responsible expectation;
- build durable relevance after launch through genuine user adoption, useful supporting UCAT resources, appropriate internal links, and credible third-party mentions—not a rushed new domain or thin keyword pages.

## Decision checklist

- [ ] Launch at permanent `https://altitutor.com/ucat/` rather than defer for the full redesign.
- [ ] Fix all root sitemap errors and submit `/sitemap.xml` directly in Search Console.
- [ ] Add crawlable contextual links from `/` and `/classes/ucatprep/` (and preferably site navigation/footer).
- [ ] Make the visible heading/introduction explicitly describe the online UCAT ANZ offering.
- [ ] Live-test and request indexing for the trailing-slash canonical once.
- [ ] Monitor URL Inspection, Page indexing, Sitemaps, and query/page performance through launch and the following weeks.
- [ ] Preserve `/ucat/` and its core intent when the redesign ships.
