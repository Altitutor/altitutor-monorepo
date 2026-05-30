# Dedicated Marketing Web App

Altitutor's root-domain Marketing site is served by a dedicated `marketing-web` app instead of being folded into `student-web` or `ucat-web`. The root domain has its own SEO-sensitive URL history, sitemap, redirects, and public acquisition pages, while the Product apps own authenticated learning, booking, checkout, and account workflows; keeping those boundaries separate reduces migration risk and lets product surfaces evolve without accidentally changing indexed marketing URLs.
