# Dependency assessment — 29 October 2026

## Recommendation

Prioritize the unsupported web framework and lint toolchain. Plan Next 16 + React 19 + matching eslint-config-next + ESLint 10 as a coordinated program, delivered in reviewable steps. TypeScript 6.0.3 is the conservative next compiler target; do not jump to TypeScript 7 while the current parser only supports <6.1. Keep optional styling, billing and library majors separate.

## Scope and evidence

Read all 15 root/app/package manifests and the direct-dependency resolutions in pnpm-lock.yaml. Queried the live public npm registry for all 198 distinct external dependency names, plus pnpm and targeted version/compatibility metadata. The installed/deployed state was not independently verified. Versions below are **locked direct dependency versions**, not the oldest version accepted by a caret range. Latest means the publisher's npm `latest` tag observed on this date; it does not imply compatibility or security severity.

Root and marketing declare TypeScript ^5.8.3 but both lock to 5.9.3. All web React instances lock to 18.3.1. All Playwright workspaces lock to 1.56.1, even those whose manifests say ^1.41.1. These are not separate installed-version gaps.

## Priority comparison

| Priority | Area | Locked now | Upstream latest | Assessment |
| --- | --- | --- | --- | --- |
| Prioritize | Next.js | 14.2.35 | 16.4.3 | Move all five web apps to a supported line. Next 14 is unsupported; 15 support ends Jan 31, 2027. Coordinate React, Next MDX, UI peers and lint config. [Source](https://nextjs.org/support-policy) |
| Prioritize | React / React DOM (web) | 18.3.1 | 19.3.1 | Bundle with Next migration, React types, shared UI peers, Testing Library and React-dependent libraries. Keep native React Expo-managed. [Source](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) |
| Prioritize | ESLint | 8.57.1 | 10.13.0 | 8 and 9 are EOL. Migrate to flat config and explicit lint commands with matching Next 16.4+ config. Check native plugins separately. [Source](https://eslint.org/version-support/) |
| Prioritize | typescript-eslint | 6.21.0 web / 8.62.0 native | 8.72.1 | Modernize parser and plugin together. Latest supports TypeScript <6.1 and ESLint 10. [Source](https://typescript-eslint.io/users/dependency-versions/) |
| Controlled upgrade | TypeScript | 5.9.3 web / 6.0.3 native | 7.0.2 | Target 6.0.3 first for web/shared. TS 7 is a separate pilot: unsupported by current lint parser and blocked by existing <7 peer rule. [Source](https://registry.npmjs.org/%40typescript-eslint%2Fparser/latest) |
| Maintenance | pnpm | 11.7.0 | 12.16.1 | Refresh within 11 first (11.28.9). Treat 12 as its own installer/lockfile/CI migration. [Source](https://registry.npmjs.org/pnpm) |
| Maintenance | Turbo | 2.10.0 | 2.11.10 | Useful small tooling refresh; verify pnpm integration and build cache behavior. [Source](https://registry.npmjs.org/turbo/latest) |
| Maintenance | Playwright | 1.56.1 | 1.64.1 | Good value: newer browsers and fixes. Update browser binaries and CI cache in the same change. [Source](https://registry.npmjs.org/%40playwright%2Ftest/latest) |
| Maintenance | Supabase JS / SSR | 2.78.0–2.112.3 / 0.12.4 | 2.118.0 / 0.12.7 | Student native client is substantially older. Align deliberately; latest JS needs Node >=22, SSR needs JS ^2.114.0. Test auth/session behavior. [Source](https://registry.npmjs.org/%40supabase%2Fssr/latest) |
| Maintenance | Supabase CLI | 2.108.0 | 2.122.0 | Separate local/CI tool refresh; verify owned disposable database scripts. No remote database change needed for this assessment. [Source](https://registry.npmjs.org/supabase/latest) |
| Maintenance | TanStack Query | 5.90.6 | 5.105.0 | Reasonable same-major refresh with matching devtools and query-flow smoke tests. [Source](https://registry.npmjs.org/%40tanstack%2Freact-query/latest) |
| Maintenance | Tiptap family | 3.22.5 | 3.32.1 | Upgrade every Tiptap package and the two workspace overrides together; verify editor content round-trips. [Source](https://registry.npmjs.org/%40tiptap%2Fcore/latest) |
| Maintenance | PostHog browser / node | 1.402.0 / 5.45.2 | 1.442.0 / 5.60.0 | Same-major candidates. Check Node floor (latest node SDK needs ^20.20 or >=22.22) and telemetry consent/capture flows. [Source](https://registry.npmjs.org/posthog-node/latest) |
| Separate migration | Jest | 29.7.0 | 30.5.2 | Worth doing after runtime work; align globals/types/jsdom environment. DOM and matcher changes can affect tests. [Source](https://jestjs.io/docs/upgrading-to-jest30) |
| Separate migration | Storybook / Vite | 8.6.17 / 6.4.1 | 10.6.5 / 8.3.5 | Upgrade Storybook through 9, then 10; ESM config and addon consolidation. Vite 6.4 still gets security backports. [Source](https://storybook.js.org/docs/releases/migration-guide) |
| Separate migration | Expo / React Native | 57.0.24–25 / 0.86.3 | 58.0.21 / 0.88.1 | One SDK behind; 58 released Oct 15. Use Expo-compatible sets, not each library latest. Native build/device verification required. [Source](https://expo.dev/changelog) |
| Separate migration | Sentry Next SDK | 10.65.0 | 11.10.0 | Review migration and verify source maps/error capture; do not mix an observability major into unrelated bumps. [Source](https://registry.npmjs.org/%40sentry%2Fnextjs/latest) |
| Separate migration | Stripe server SDK | 20.1.0 | 23.0.1 | Billing upgrade with explicit API version review, webhook/checkout/subscription tests and owner approval. Several call sites pin 2025-12-15.clover. [Source](https://registry.npmjs.org/stripe/latest) |
| Defer | Tailwind / tailwind-merge | 3.4.18 / 2.6.0 | 4.3.3 / 3.7.0 | Broad CSS/visual migration. Browser baseline changes; verify utility/default changes across shared UI. No need to bundle with Next. [Source](https://tailwindcss.com/docs/upgrade-guide) |
| Defer | Zod / Zustand | 3.25.76 / 4.5.7 | 4.6.7 / 5.0.16 | Do when schema typing, performance, or a feature benefits. Separate behavioral changes from framework upgrades. [Source](https://registry.npmjs.org/zod/latest) |
| Defer | Lucide icons | 0.323.0 | 1.64.0 | Large numeric gap, limited urgency. Upgrade if icon additions or compatibility are useful; check removed/renamed exports. [Source](https://registry.npmjs.org/lucide-react/latest) |

## Concrete migration constraints

- All web apps use Next 14.2.35, the last published 14.x stable. A patch-only update will not move them back into normal support. Next 16 is Active LTS; Next 15 security support is extended only to 2027-01-31. [Next support](https://nextjs.org/support-policy), [publisher tags](https://registry.npmjs.org/next).
- Four apps still invoke `next lint`; all web configs include `eslint.ignoreDuringBuilds`. Next 16 removes these and requires explicit linting. Student, tutor and UCAT have custom Webpack behavior; preserve it initially with `--webpack` or deliberately migrate it to Turbopack. Some route params still need the async migration. [Next 16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16).
- `packages/ui` peers Next 14 and React 18. React 19 requires coordinating these peers, React DOM/types and testing-library/react (14.3.1 → current 16.3.3), plus any React-bound leaf libraries. `packages/shared` already permits React 18–19, and native injects it to isolate React resolution. [React upgrade](https://react.dev/blog/2024/04/25/react-19-upgrade-guide).
- ESLint 10 removes `.eslintrc` support. Next 16.4+ wraps React/import plugins for ESLint 10, but the raw current `eslint-plugin-react` package still advertises peers only through ESLint 9. Native Expo configs and direct plugin use need separate compatibility verification; disabling strict peer checks does not prove runtime compatibility. [ESLint migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0), [Next adapter source](https://raw.githubusercontent.com/vercel/next.js/v16.4.3/packages/eslint-config-next/src/index.ts), [plugin metadata](https://registry.npmjs.org/eslint-plugin-react/latest).
- TypeScript 7.0.2 is stable, but current typescript-eslint 8.72.1 explicitly supports TypeScript >=4.8.4 <6.1.0. The workspace permits TypeScript <7; root tsconfig uses `baseUrl`, removed in 7. Test TS6 default/global typing changes first. Native is already on 6.0.3. [Parser metadata](https://registry.npmjs.org/%40typescript-eslint%2Fparser/latest), [TS6 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html), [TS7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
- CI mostly uses Node 24, with some Node 22 jobs. Local shell reports 22.23.1. Node 24 remains an appropriate LTS baseline; no urgent Node major migration. Most @types/node declarations still target 20, so align the types with each workspace's intended runtime instead of blindly adopting latest 26. [Node releases](https://nodejs.org/en/about/previous-releases).
- Existing overrides (including Tiptap), the react-big-calendar@1.19.4 patch, and the Storybook React18 package extension must be reviewed when bumping their owning dependencies. A blanket update would require deliberate patch rebasing and peer cleanup.
- Lower-priority majors also include TanStack Table 8→9, Motion 12→14, PDF.js 5→6 / React PDF 10→11, dropzone 14→20, uuid 11→14, and react-leaflet 4→5. Group by feature and verify behavior rather than update all at once. Their exact observed versions and sources appear in the inventory below.

## Suggested delivery boundaries

1. Small maintenance changes: pnpm 11 refresh, Turbo, Playwright/browser binaries, then coherent SDK families. Same-major does not guarantee zero behavior changes.
2. Web modernization: Next/React/shared UI/Next lint config and ESLint migration, with TypeScript 6 as a separately verifiable step. Build all five web apps, run pnpm checkall, and smoke auth/session, billing, editors/PDFs and core UCAT flows.
3. Separate work for Jest/Storybook/Vite, Expo58, Sentry11 and Stripe23. Billing needs explicit owner approval under repository policy.
4. Defer Tailwind4 and discretionary application majors until they solve an identified problem. Pilot TS7 only after parser and other compiler integrations support it.

## Existing documentation drift

`docs/dependency-upgrade-plan.md` is dated June29 and is stale: it describes student-app as Expo56 (both native apps now use57), Supabase SSR as0.5.2 (locked0.12.4), and current TypeScript as6.x (latest7.0.2). It also mentions Vitest, but the inspected workspace manifests have no direct Vitest dependency. Use this dated assessment as the newer evidence; the existing plan was not rewritten.

## Vulnerability audit

The user explicitly approved `pnpm audit` after automatic review initially rejected dependency-metadata egress. The approved command produced no JSON after more than four minutes; a retry with a 30-second fetch timeout and zero retries also produced no JSON after over a minute. Both task-owned processes were terminated. No vulnerability counts or clean-security claim are available. The assessment identifies unsupported releases and version gaps only; it does not establish exploitable vulnerabilities. No audit fixes were applied.

## Full direct dependency inventory

The source link for each row is the publisher's public npm registry metadata. Legacy retired Storybook packages can have `latest` tags older than the checked-in resolution: these are **not downgrade recommendations**. Internal workspace packages are excluded. Native module latest tags are informational; Expo's compatibility matrix controls the actual target.

| Package | Locked direct versions | Registry latest | Workspaces |
| --- | --- | --- | --- |
| [@ai-sdk/react](https://registry.npmjs.org/@ai-sdk%2Freact/latest) | 4.0.10 | 4.0.160 | apps/tutor-web |
| [@daily-co/daily-js](https://registry.npmjs.org/@daily-co%2Fdaily-js/latest) | 0.94.0 | 0.94.0 | packages/ui |
| [@dnd-kit/core](https://registry.npmjs.org/@dnd-kit%2Fcore/latest) | 6.3.1 | 6.3.1 | apps/admin-web, apps/tutor-web, packages/ui |
| [@dnd-kit/sortable](https://registry.npmjs.org/@dnd-kit%2Fsortable/latest) | 10.0.0 | 10.0.0 | apps/admin-web, apps/tutor-web, packages/ui |
| [@dnd-kit/utilities](https://registry.npmjs.org/@dnd-kit%2Futilities/latest) | 3.2.2 | 3.2.2 | apps/admin-web, apps/tutor-web, packages/ui |
| [@expo/dom-webview](https://registry.npmjs.org/@expo%2Fdom-webview/latest) | 57.0.1 | 58.0.2 | apps/student-app, apps/ucat-app |
| [@expo/ui](https://registry.npmjs.org/@expo%2Fui/latest) | 57.0.20, 57.0.19 | 58.0.25 | apps/student-app, apps/ucat-app |
| [@fontsource-variable/cormorant-garamond](https://registry.npmjs.org/@fontsource-variable%2Fcormorant-garamond/latest) | 5.3.0 | 5.3.0 | apps/marketing-web |
| [@fontsource-variable/outfit](https://registry.npmjs.org/@fontsource-variable%2Foutfit/latest) | 5.3.0 | 5.3.0 | apps/marketing-web |
| [@fontsource-variable/plus-jakarta-sans](https://registry.npmjs.org/@fontsource-variable%2Fplus-jakarta-sans/latest) | 5.3.0 | 5.3.0 | apps/marketing-web |
| [@fontsource/ibm-plex-mono](https://registry.npmjs.org/@fontsource%2Fibm-plex-mono/latest) | 5.3.0 | 5.3.0 | apps/marketing-web |
| [@gsap/react](https://registry.npmjs.org/@gsap%2Freact/latest) | 2.1.2 | 2.1.2 | apps/ucat-web |
| [@hookform/resolvers](https://registry.npmjs.org/@hookform%2Fresolvers/latest) | 5.2.2 | 6.0.2 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@jest/globals](https://registry.npmjs.org/@jest%2Fglobals/latest) | 29.7.0 | 30.5.2 | apps/tutor-web |
| [@mdx-js/loader](https://registry.npmjs.org/@mdx-js%2Floader/latest) | 3.1.1 | 3.1.1 | apps/marketing-web |
| [@mdx-js/react](https://registry.npmjs.org/@mdx-js%2Freact/latest) | 3.1.1 | 3.1.1 | apps/marketing-web |
| [@modelcontextprotocol/sdk](https://registry.npmjs.org/@modelcontextprotocol%2Fsdk/latest) | 1.26.0 | 1.32.2 | apps/admin-web, apps/tutor-web |
| [@next/mdx](https://registry.npmjs.org/@next%2Fmdx/latest) | 14.2.35 | 16.4.3 | apps/marketing-web |
| [@open-spaced-repetition/binding](https://registry.npmjs.org/@open-spaced-repetition%2Fbinding/latest) | 0.5.0 | 0.6.0 | apps/student-web |
| [@playwright/test](https://registry.npmjs.org/@playwright%2Ftest/latest) | 1.56.1 | 1.64.1 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [@radix-ui/react-accordion](https://registry.npmjs.org/@radix-ui%2Freact-accordion/latest) | 1.2.12 | 1.3.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-alert-dialog](https://registry.npmjs.org/@radix-ui%2Freact-alert-dialog/latest) | 1.1.15 | 1.2.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-checkbox](https://registry.npmjs.org/@radix-ui%2Freact-checkbox/latest) | 1.3.3 | 1.4.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-dialog](https://registry.npmjs.org/@radix-ui%2Freact-dialog/latest) | 1.1.15 | 1.3.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-dropdown-menu](https://registry.npmjs.org/@radix-ui%2Freact-dropdown-menu/latest) | 2.1.16 | 2.2.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-icons](https://registry.npmjs.org/@radix-ui%2Freact-icons/latest) | 1.3.2 | 1.3.2 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@radix-ui/react-label](https://registry.npmjs.org/@radix-ui%2Freact-label/latest) | 2.1.7 | 2.1.17 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-popover](https://registry.npmjs.org/@radix-ui%2Freact-popover/latest) | 1.1.15 | 1.3.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-radio-group](https://registry.npmjs.org/@radix-ui%2Freact-radio-group/latest) | 1.3.8 | 1.5.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-scroll-area](https://registry.npmjs.org/@radix-ui%2Freact-scroll-area/latest) | 1.2.10 | 1.4.0 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-select](https://registry.npmjs.org/@radix-ui%2Freact-select/latest) | 2.2.6 | 2.4.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-separator](https://registry.npmjs.org/@radix-ui%2Freact-separator/latest) | 1.1.7 | 1.2.0 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-slot](https://registry.npmjs.org/@radix-ui%2Freact-slot/latest) | 1.2.3 | 1.5.0 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-switch](https://registry.npmjs.org/@radix-ui%2Freact-switch/latest) | 1.2.6 | 1.4.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-tabs](https://registry.npmjs.org/@radix-ui%2Freact-tabs/latest) | 1.1.13 | 1.2.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@radix-ui/react-tooltip](https://registry.npmjs.org/@radix-ui%2Freact-tooltip/latest) | 1.2.8 | 1.4.1 | packages/ui |
| [@react-native-async-storage/async-storage](https://registry.npmjs.org/@react-native-async-storage%2Fasync-storage/latest) | 2.2.0 | 3.1.1 | apps/student-app, apps/ucat-app |
| [@react-pdf/renderer](https://registry.npmjs.org/@react-pdf%2Frenderer/latest) | 4.5.1 | 4.9.0 | apps/admin-web, apps/tutor-web |
| [@sentry/cli](https://registry.npmjs.org/@sentry%2Fcli/latest) | 2.58.4 | 3.8.2 | apps/ucat-app |
| [@sentry/nextjs](https://registry.npmjs.org/@sentry%2Fnextjs/latest) | 10.65.0 | 11.10.0 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [@sentry/react-native](https://registry.npmjs.org/@sentry%2Freact-native/latest) | 7.11.0 | 8.33.0 | apps/ucat-app |
| [@storybook/addon-a11y](https://registry.npmjs.org/@storybook%2Faddon-a11y/latest) | 8.6.17 | 10.6.5 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@storybook/addon-essentials](https://registry.npmjs.org/@storybook%2Faddon-essentials/latest) | 8.6.17 | 8.6.14 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@storybook/addon-interactions](https://registry.npmjs.org/@storybook%2Faddon-interactions/latest) | 8.6.17 | 8.6.14 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@storybook/addon-onboarding](https://registry.npmjs.org/@storybook%2Faddon-onboarding/latest) | 8.6.17 | 10.6.5 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@storybook/addon-themes](https://registry.npmjs.org/@storybook%2Faddon-themes/latest) | 8.6.17 | 10.6.5 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@storybook/blocks](https://registry.npmjs.org/@storybook%2Fblocks/latest) | 8.6.17 | 8.6.14 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@storybook/nextjs](https://registry.npmjs.org/@storybook%2Fnextjs/latest) | 8.6.17 | 10.6.5 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@storybook/react](https://registry.npmjs.org/@storybook%2Freact/latest) | 8.6.17 | 10.6.5 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@storybook/test](https://registry.npmjs.org/@storybook%2Ftest/latest) | 8.6.17 | 8.6.15 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@stripe/react-stripe-js](https://registry.npmjs.org/@stripe%2Freact-stripe-js/latest) | 5.3.0 | 7.0.1 | apps/admin-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [@stripe/stripe-js](https://registry.npmjs.org/@stripe%2Fstripe-js/latest) | 8.2.0 | 10.2.0 | apps/admin-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [@supabase/ssr](https://registry.npmjs.org/@supabase%2Fssr/latest) | 0.12.4 | 0.12.7 | apps/admin-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [@supabase/supabase-js](https://registry.npmjs.org/@supabase%2Fsupabase-js/latest) | 2.112.3, 2.78.0 | 2.118.0 | apps/admin-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, apps/ucat-web, packages/shared |
| [@swc/core](https://registry.npmjs.org/@swc%2Fcore/latest) | 1.14.0, 1.15.3 | 1.16.20 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [@swc/jest](https://registry.npmjs.org/@swc%2Fjest/latest) | 0.2.39 | 0.2.39 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/email, packages/shared, packages/ucat-blueprint, packages/ucat-marking, packages/ucat-percentiles, packages/ucat-response-contract, packages/ui |
| [@tailwindcss/typography](https://registry.npmjs.org/@tailwindcss%2Ftypography/latest) | 0.5.19 | 0.5.20 | apps/admin-web, apps/marketing-web, apps/student-web |
| [@tanstack/react-query](https://registry.npmjs.org/@tanstack%2Freact-query/latest) | 5.90.6 | 5.105.0 | apps/admin-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, apps/ucat-web |
| [@tanstack/react-query-devtools](https://registry.npmjs.org/@tanstack%2Freact-query-devtools/latest) | 5.90.2 | 5.105.0 | apps/admin-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [@tanstack/react-table](https://registry.npmjs.org/@tanstack%2Freact-table/latest) | 8.21.3 | 9.3.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [@tanstack/react-virtual](https://registry.npmjs.org/@tanstack%2Freact-virtual/latest) | 3.13.12 | 3.14.24 | apps/admin-web, apps/tutor-web, packages/ui |
| [@testing-library/jest-dom](https://registry.npmjs.org/@testing-library%2Fjest-dom/latest) | 6.9.1 | 7.0.1 | apps/admin-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [@testing-library/react](https://registry.npmjs.org/@testing-library%2Freact/latest) | 14.3.1 | 16.3.3 | apps/admin-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/shared |
| [@testing-library/user-event](https://registry.npmjs.org/@testing-library%2Fuser-event/latest) | 14.6.1 | 14.6.8 | apps/admin-web |
| [@tiptap/core](https://registry.npmjs.org/@tiptap%2Fcore/latest) | 3.22.5 | 3.32.1 | apps/admin-web, apps/tutor-web, packages/ui |
| [@tiptap/extension-details](https://registry.npmjs.org/@tiptap%2Fextension-details/latest) | 3.22.5 | 3.32.1 | apps/admin-web, packages/ui |
| [@tiptap/extension-heading](https://registry.npmjs.org/@tiptap%2Fextension-heading/latest) | 3.22.5 | 3.32.1 | packages/ui |
| [@tiptap/extension-image](https://registry.npmjs.org/@tiptap%2Fextension-image/latest) | 3.22.5 | 3.32.1 | apps/admin-web, apps/tutor-web, packages/ui |
| [@tiptap/extension-link](https://registry.npmjs.org/@tiptap%2Fextension-link/latest) | 3.22.5 | 3.32.1 | packages/ui |
| [@tiptap/extension-mathematics](https://registry.npmjs.org/@tiptap%2Fextension-mathematics/latest) | 3.22.5 | 3.32.1 | apps/tutor-web, packages/ui |
| [@tiptap/extension-mention](https://registry.npmjs.org/@tiptap%2Fextension-mention/latest) | 3.22.5 | 3.32.1 | apps/admin-web, packages/ui |
| [@tiptap/extension-placeholder](https://registry.npmjs.org/@tiptap%2Fextension-placeholder/latest) | 3.22.5 | 3.32.1 | apps/admin-web, packages/ui |
| [@tiptap/extension-table](https://registry.npmjs.org/@tiptap%2Fextension-table/latest) | 3.22.5 | 3.32.1 | apps/admin-web, apps/tutor-web, packages/ui |
| [@tiptap/extension-text-style](https://registry.npmjs.org/@tiptap%2Fextension-text-style/latest) | 3.22.5 | 3.32.1 | apps/admin-web, packages/ui |
| [@tiptap/extension-typography](https://registry.npmjs.org/@tiptap%2Fextension-typography/latest) | 3.22.5 | 3.32.1 | apps/admin-web, packages/ui |
| [@tiptap/markdown](https://registry.npmjs.org/@tiptap%2Fmarkdown/latest) | 3.22.5 | 3.32.1 | apps/admin-web, packages/ui |
| [@tiptap/pm](https://registry.npmjs.org/@tiptap%2Fpm/latest) | 3.22.5 | 3.32.1 | apps/admin-web, apps/tutor-web, packages/ui |
| [@tiptap/react](https://registry.npmjs.org/@tiptap%2Freact/latest) | 3.22.5 | 3.32.1 | apps/admin-web, apps/tutor-web, packages/ui |
| [@tiptap/starter-kit](https://registry.npmjs.org/@tiptap%2Fstarter-kit/latest) | 3.22.5 | 3.32.1 | apps/admin-web, apps/tutor-web, packages/ui |
| [@tiptap/suggestion](https://registry.npmjs.org/@tiptap%2Fsuggestion/latest) | 3.22.5 | 3.32.1 | apps/admin-web, packages/ui |
| [@types/jest](https://registry.npmjs.org/@types%2Fjest/latest) | 29.5.14 | 30.0.0 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/email, packages/shared, packages/ucat-blueprint, packages/ucat-marking, packages/ucat-percentiles, packages/ucat-response-contract, packages/ui |
| [@types/leaflet](https://registry.npmjs.org/@types%2Fleaflet/latest) | 1.9.21 | 1.9.22 | apps/student-web |
| [@types/mdx](https://registry.npmjs.org/@types%2Fmdx/latest) | 2.0.13 | 2.0.14 | apps/marketing-web |
| [@types/node](https://registry.npmjs.org/@types%2Fnode/latest) | 20.19.24, 24.13.3 | 26.6.6 | apps/admin-web, apps/marketing-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, apps/ucat-web, packages/email, packages/ui |
| [@types/react](https://registry.npmjs.org/@types%2Freact/latest) | 18.3.26, 19.2.15 | 19.3.0 | apps/admin-web, apps/marketing-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, apps/ucat-web, packages/shared, packages/ui |
| [@types/react-big-calendar](https://registry.npmjs.org/@types%2Freact-big-calendar/latest) | 1.16.3 | 1.16.3 | apps/tutor-web, packages/ui |
| [@types/react-dom](https://registry.npmjs.org/@types%2Freact-dom/latest) | 18.3.7, 19.2.3 | 19.3.0 | apps/admin-web, apps/marketing-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, apps/ucat-web, packages/shared, packages/ui |
| [@types/uuid](https://registry.npmjs.org/@types%2Fuuid/latest) | 10.0.0 | 11.0.0 | apps/admin-web, apps/student-web, apps/tutor-web |
| [@typescript-eslint/eslint-plugin](https://registry.npmjs.org/@typescript-eslint%2Feslint-plugin/latest) | 6.21.0, 8.62.0 | 8.72.1 | ., apps/admin-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, packages/email, packages/shared, packages/ucat-blueprint, packages/ucat-marking, packages/ucat-percentiles, packages/ucat-response-contract, packages/ui |
| [@typescript-eslint/parser](https://registry.npmjs.org/@typescript-eslint%2Fparser/latest) | 6.21.0, 8.62.0 | 8.72.1 | ., apps/admin-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, packages/email, packages/shared, packages/ucat-blueprint, packages/ucat-marking, packages/ucat-percentiles, packages/ucat-response-contract, packages/ui |
| [@vercel/functions](https://registry.npmjs.org/@vercel%2Ffunctions/latest) | 3.7.5 | 3.10.4 | apps/student-web, apps/ucat-web |
| [@vercel/queue](https://registry.npmjs.org/@vercel%2Fqueue/latest) | 0.4.0 | 0.10.0 | apps/tutor-web |
| [@vitejs/plugin-react](https://registry.npmjs.org/@vitejs%2Fplugin-react/latest) | 4.7.0 | 6.1.2 | apps/admin-web, apps/student-web, apps/tutor-web |
| [ai](https://registry.npmjs.org/ai/latest) | 7.0.9 | 7.0.156 | apps/tutor-web |
| [autoprefixer](https://registry.npmjs.org/autoprefixer/latest) | 10.4.21 | 10.6.2 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [chrono-node](https://registry.npmjs.org/chrono-node/latest) | 2.9.1 | 2.10.3 | packages/ui |
| [class-variance-authority](https://registry.npmjs.org/class-variance-authority/latest) | 0.7.1 | 0.7.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [clsx](https://registry.npmjs.org/clsx/latest) | 2.1.1 | 2.1.1 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/ui |
| [cmdk](https://registry.npmjs.org/cmdk/latest) | 1.1.1 | 1.1.1 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [date-fns](https://registry.npmjs.org/date-fns/latest) | 4.1.0 | 4.4.0 | apps/admin-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/shared, packages/ui |
| [datebook](https://registry.npmjs.org/datebook/latest) | 8.0.1 | 8.0.1 | apps/student-web |
| [dotenv](https://registry.npmjs.org/dotenv/latest) | 16.6.1 | 18.0.9 | apps/admin-web, apps/student-web, apps/tutor-web |
| [dotenv-cli](https://registry.npmjs.org/dotenv-cli/latest) | 8.0.0 | 11.1.0 | apps/admin-web, apps/student-web, apps/tutor-web |
| [esbuild](https://registry.npmjs.org/esbuild/latest) | 0.25.12 | 0.28.2 | packages/email |
| [eslint](https://registry.npmjs.org/eslint/latest) | 8.57.1 | 10.13.0 | ., apps/admin-web, apps/marketing-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, apps/ucat-web, packages/email, packages/shared, packages/ucat-blueprint, packages/ucat-marking, packages/ucat-percentiles, packages/ucat-response-contract, packages/ui |
| [eslint-config-expo](https://registry.npmjs.org/eslint-config-expo/latest) | 57.0.2 | 58.0.4 | apps/student-app, apps/ucat-app |
| [eslint-config-next](https://registry.npmjs.org/eslint-config-next/latest) | 14.1.0 | 16.4.3 | ., apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/email, packages/shared, packages/ucat-blueprint, packages/ucat-marking, packages/ucat-percentiles, packages/ucat-response-contract, packages/ui |
| [eslint-import-resolver-typescript](https://registry.npmjs.org/eslint-import-resolver-typescript/latest) | 3.10.1 | 4.4.5 | apps/student-app, apps/ucat-app |
| [eslint-plugin-expo](https://registry.npmjs.org/eslint-plugin-expo/latest) | 1.0.3, 1.1.0 | 1.2.1 | apps/student-app, apps/ucat-app |
| [eslint-plugin-import](https://registry.npmjs.org/eslint-plugin-import/latest) | 2.32.0 | 2.32.0 | apps/student-app, apps/ucat-app |
| [eslint-plugin-react](https://registry.npmjs.org/eslint-plugin-react/latest) | 7.37.5 | 7.37.5 | apps/student-app, apps/ucat-app |
| [eslint-plugin-react-hooks](https://registry.npmjs.org/eslint-plugin-react-hooks/latest) | 7.1.1 | 7.1.1 | apps/student-app, apps/ucat-app |
| [eslint-plugin-storybook](https://registry.npmjs.org/eslint-plugin-storybook/latest) | 0.12.0 | 10.6.5 | ., apps/admin-web, apps/student-web, apps/tutor-web, packages/shared, packages/ucat-marking, packages/ucat-percentiles, packages/ui |
| [expo](https://registry.npmjs.org/expo/latest) | 57.0.25, 57.0.24 | 58.0.21 | apps/student-app, apps/ucat-app |
| [expo-constants](https://registry.npmjs.org/expo-constants/latest) | 57.0.19 | 58.0.14 | apps/student-app, apps/ucat-app |
| [expo-crypto](https://registry.npmjs.org/expo-crypto/latest) | 57.0.3 | 58.0.7 | apps/student-app, apps/ucat-app |
| [expo-dev-client](https://registry.npmjs.org/expo-dev-client/latest) | 57.0.19 | 58.0.17 | apps/ucat-app |
| [expo-font](https://registry.npmjs.org/expo-font/latest) | 57.0.4 | 58.0.11 | apps/ucat-app |
| [expo-haptics](https://registry.npmjs.org/expo-haptics/latest) | 57.0.3 | 58.0.7 | apps/student-app, apps/ucat-app |
| [expo-image](https://registry.npmjs.org/expo-image/latest) | 57.0.5 | 58.0.18 | apps/student-app, apps/ucat-app |
| [expo-linking](https://registry.npmjs.org/expo-linking/latest) | 57.0.11, 57.0.10 | 58.0.15 | apps/student-app, apps/ucat-app |
| [expo-network](https://registry.npmjs.org/expo-network/latest) | 57.0.2 | 58.0.4 | apps/student-app |
| [expo-notifications](https://registry.npmjs.org/expo-notifications/latest) | 57.0.21 | 58.1.7 | apps/student-app, apps/ucat-app |
| [expo-router](https://registry.npmjs.org/expo-router/latest) | 57.0.23, 57.0.22 | 58.0.28 | apps/student-app, apps/ucat-app |
| [expo-secure-store](https://registry.npmjs.org/expo-secure-store/latest) | 57.0.4 | 58.0.2 | apps/student-app, apps/ucat-app |
| [expo-splash-screen](https://registry.npmjs.org/expo-splash-screen/latest) | 57.0.9 | 58.0.12 | apps/student-app, apps/ucat-app |
| [expo-status-bar](https://registry.npmjs.org/expo-status-bar/latest) | 57.0.1 | 58.0.4 | apps/student-app, apps/ucat-app |
| [expo-system-ui](https://registry.npmjs.org/expo-system-ui/latest) | 57.0.4 | 58.0.7 | apps/ucat-app |
| [expo-updates](https://registry.npmjs.org/expo-updates/latest) | 57.0.23 | 58.0.19 | apps/student-app, apps/ucat-app |
| [expo-video](https://registry.npmjs.org/expo-video/latest) | 57.0.5 | 58.0.13 | apps/student-app |
| [expo-web-browser](https://registry.npmjs.org/expo-web-browser/latest) | 57.0.3 | 58.0.7 | apps/student-app, apps/ucat-app |
| [gsap](https://registry.npmjs.org/gsap/latest) | 3.14.2 | 3.15.0 | apps/marketing-web, apps/student-web, apps/ucat-web |
| [identity-obj-proxy](https://registry.npmjs.org/identity-obj-proxy/latest) | 3.0.0 | 3.0.0 | apps/admin-web, apps/ucat-web |
| [jest](https://registry.npmjs.org/jest/latest) | 29.7.0 | 30.5.2 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/email, packages/shared, packages/ucat-blueprint, packages/ucat-marking, packages/ucat-percentiles, packages/ucat-response-contract, packages/ui |
| [jest-environment-jsdom](https://registry.npmjs.org/jest-environment-jsdom/latest) | 29.7.0 | 30.5.2 | apps/admin-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/shared, packages/ui |
| [js-yaml](https://registry.npmjs.org/js-yaml/latest) | 4.1.1 | 5.5.0 | apps/admin-web, apps/student-web, apps/tutor-web |
| [jsdom](https://registry.npmjs.org/jsdom/latest) | 24.1.3 | 30.1.3 | apps/admin-web, apps/student-web, apps/tutor-web |
| [katex](https://registry.npmjs.org/katex/latest) | 0.16.22 | 0.19.1 | packages/ui |
| [leaflet](https://registry.npmjs.org/leaflet/latest) | 1.9.4 | 1.9.4 | apps/student-web |
| [libphonenumber-js](https://registry.npmjs.org/libphonenumber-js/latest) | 1.12.33 | 1.13.15 | packages/ui |
| [lucide-react](https://registry.npmjs.org/lucide-react/latest) | 0.323.0 | 1.64.0 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/ui |
| [mcp-handler](https://registry.npmjs.org/mcp-handler/latest) | 1.1.0 | 2.3.0 | apps/admin-web, apps/tutor-web |
| [ml-levenberg-marquardt](https://registry.npmjs.org/ml-levenberg-marquardt/latest) | 5.0.1 | 5.1.0 | apps/ucat-web |
| [motion](https://registry.npmjs.org/motion/latest) | 12.38.0 | 14.7.1 | apps/marketing-web, apps/student-web, apps/ucat-web |
| [next](https://registry.npmjs.org/next/latest) | 14.2.35 | 16.4.3 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web, packages/ui |
| [next-themes](https://registry.npmjs.org/next-themes/latest) | 0.2.1 | 0.4.6 | apps/admin-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [nextstepjs](https://registry.npmjs.org/nextstepjs/latest) | 2.2.0 | 2.3.0 | apps/student-web, apps/ucat-web |
| [pdfjs-dist](https://registry.npmjs.org/pdfjs-dist/latest) | 5.4.394 | 6.4.299 | apps/admin-web, apps/student-web, apps/tutor-web |
| [pgsql-ast-parser](https://registry.npmjs.org/pgsql-ast-parser/latest) | 12.0.1 | 12.0.2 | apps/admin-web |
| [postcss](https://registry.npmjs.org/postcss/latest) | 8.5.15 | 8.5.32 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [postgres](https://registry.npmjs.org/postgres/latest) | 3.4.8 | 3.4.9 | apps/admin-web |
| [posthog-js](https://registry.npmjs.org/posthog-js/latest) | 1.402.0 | 1.442.0 | apps/marketing-web, apps/student-web, apps/ucat-web |
| [posthog-node](https://registry.npmjs.org/posthog-node/latest) | 5.45.2 | 5.60.0 | apps/student-web, apps/ucat-web |
| [prettier](https://registry.npmjs.org/prettier/latest) | 3.6.2 | 3.9.10 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [react](https://registry.npmjs.org/react/latest) | 18.3.1, 19.2.3 | 19.3.1 | apps/admin-web, apps/marketing-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, apps/ucat-web, packages/shared, packages/ui |
| [react-big-calendar](https://registry.npmjs.org/react-big-calendar/latest) | 1.19.4 | 1.20.0 | apps/tutor-web, packages/ui |
| [react-dom](https://registry.npmjs.org/react-dom/latest) | 18.3.1, 19.2.3 | 19.3.1 | apps/admin-web, apps/marketing-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, apps/ucat-web, packages/shared, packages/ui |
| [react-dropzone](https://registry.npmjs.org/react-dropzone/latest) | 14.3.8 | 20.1.4 | apps/admin-web, apps/tutor-web |
| [react-hook-form](https://registry.npmjs.org/react-hook-form/latest) | 7.66.0 | 7.91.0 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [react-leaflet](https://registry.npmjs.org/react-leaflet/latest) | 4.2.1 | 5.0.0 | apps/student-web |
| [react-markdown](https://registry.npmjs.org/react-markdown/latest) | 9.1.0 | 10.1.0 | apps/admin-web |
| [react-native](https://registry.npmjs.org/react-native/latest) | 0.86.3 | 0.88.1 | apps/student-app, apps/ucat-app |
| [react-native-gesture-handler](https://registry.npmjs.org/react-native-gesture-handler/latest) | 2.32.0 | 3.4.0 | apps/student-app, apps/ucat-app |
| [react-native-reanimated](https://registry.npmjs.org/react-native-reanimated/latest) | 4.5.1 | 4.7.1 | apps/student-app, apps/ucat-app |
| [react-native-safe-area-context](https://registry.npmjs.org/react-native-safe-area-context/latest) | 5.7.0 | 5.11.0 | apps/student-app, apps/ucat-app |
| [react-native-screens](https://registry.npmjs.org/react-native-screens/latest) | 4.26.2 | 4.30.1 | apps/student-app, apps/ucat-app |
| [react-native-url-polyfill](https://registry.npmjs.org/react-native-url-polyfill/latest) | 2.0.0 | 4.0.0 | apps/student-app, apps/ucat-app |
| [react-native-web](https://registry.npmjs.org/react-native-web/latest) | 0.21.2 | 0.21.4 | apps/student-app, apps/ucat-app |
| [react-native-webview](https://registry.npmjs.org/react-native-webview/latest) | 13.16.1 | 14.0.1 | apps/student-app |
| [react-native-worklets](https://registry.npmjs.org/react-native-worklets/latest) | 0.10.1 | 0.13.1 | apps/student-app, apps/ucat-app |
| [react-pdf](https://registry.npmjs.org/react-pdf/latest) | 10.2.0 | 11.0.0 | apps/admin-web, apps/tutor-web |
| [react-phone-number-input](https://registry.npmjs.org/react-phone-number-input/latest) | 3.4.14 | 3.4.18 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [react-remove-scroll](https://registry.npmjs.org/react-remove-scroll/latest) | 2.7.1 | 2.7.2 | packages/ui |
| [react-resizable-panels](https://registry.npmjs.org/react-resizable-panels/latest) | 4.12.3 | 4.15.1 | packages/ui |
| [recharts](https://registry.npmjs.org/recharts/latest) | 3.7.0, 3.10.1 | 3.10.1 | apps/admin-web, apps/tutor-web, apps/ucat-web |
| [remark-gfm](https://registry.npmjs.org/remark-gfm/latest) | 4.0.1 | 4.0.1 | apps/admin-web |
| [server-only](https://registry.npmjs.org/server-only/latest) | 0.0.1 | 0.0.1 | apps/tutor-web |
| [sharp](https://registry.npmjs.org/sharp/latest) | 0.33.5 | 0.35.5 | apps/tutor-web |
| [sonner](https://registry.npmjs.org/sonner/latest) | 2.0.7 | 2.0.8 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [storybook](https://registry.npmjs.org/storybook/latest) | 8.6.17 | 10.6.5 | apps/admin-web, apps/student-web, apps/tutor-web |
| [stripe](https://registry.npmjs.org/stripe/latest) | 20.1.0 | 23.0.1 | apps/admin-web, apps/student-web, apps/ucat-web |
| [supabase](https://registry.npmjs.org/supabase/latest) | 2.108.0 | 2.122.0 | ., apps/admin-web, apps/student-web, apps/tutor-web |
| [tailwind-merge](https://registry.npmjs.org/tailwind-merge/latest) | 2.6.0 | 3.7.0 | apps/admin-web, apps/student-web, apps/tutor-web, packages/ui |
| [tailwindcss](https://registry.npmjs.org/tailwindcss/latest) | 3.4.18 | 4.3.3 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [tailwindcss-animate](https://registry.npmjs.org/tailwindcss-animate/latest) | 1.0.7 | 1.0.7 | apps/admin-web, apps/marketing-web, apps/student-web, apps/tutor-web, apps/ucat-web |
| [tesseract.js](https://registry.npmjs.org/tesseract.js/latest) | 7.0.0 | 7.0.0 | apps/tutor-web |
| [tippy.js](https://registry.npmjs.org/tippy.js/latest) | 6.3.7 | 6.3.7 | apps/admin-web, packages/ui |
| [ts-fsrs](https://registry.npmjs.org/ts-fsrs/latest) | 5.4.1 | 6.0.0 | apps/student-web |
| [tsx](https://registry.npmjs.org/tsx/latest) | 4.21.0 | 4.23.15 | apps/student-app, apps/tutor-web, apps/ucat-app |
| [turbo](https://registry.npmjs.org/turbo/latest) | 2.10.0 | 2.11.10 | . |
| [typescript](https://registry.npmjs.org/typescript/latest) | 5.9.3, 6.0.3 | 7.0.2 | ., apps/admin-web, apps/marketing-web, apps/student-app, apps/student-web, apps/tutor-web, apps/ucat-app, apps/ucat-web, packages/email, packages/shared, packages/ucat-blueprint, packages/ucat-marking, packages/ucat-percentiles, packages/ucat-response-contract, packages/ui |
| [uuid](https://registry.npmjs.org/uuid/latest) | 11.1.0 | 14.0.3 | apps/admin-web, apps/student-web, apps/tutor-web |
| [vega](https://registry.npmjs.org/vega/latest) | 6.2.0 | 6.4.0 | apps/tutor-web |
| [vega-lite](https://registry.npmjs.org/vega-lite/latest) | 6.4.3 | 6.5.0 | apps/tutor-web |
| [vite](https://registry.npmjs.org/vite/latest) | 6.4.1 | 8.3.5 | apps/admin-web, apps/student-web, apps/tutor-web |
| [web-haptics](https://registry.npmjs.org/web-haptics/latest) | 0.0.6 | 0.0.6 | apps/admin-web, apps/student-web, apps/tutor-web |
| [zod](https://registry.npmjs.org/zod/latest) | 3.25.76 | 4.6.7 | apps/admin-web, apps/student-web, apps/tutor-web |
| [zustand](https://registry.npmjs.org/zustand/latest) | 4.5.7 | 5.0.16 | apps/admin-web, apps/student-web, apps/tutor-web |

Package manager: pnpm 11.7.0; live latest11 tag 11.28.9 and latest12/global latest 12.16.1. [Registry](https://registry.npmjs.org/pnpm).
