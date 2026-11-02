Run this benchmark against a production admin build connected to the same owned
`dev:isolated` database. It refuses unproven database targets and creates only
synthetic issues/tasks in that disposable database.

```sh
pnpm dev:isolated exec -- env ADMIN_E2E_BASE_URL=http://127.0.0.1:PREVIEW_PORT node apps/admin-web/scripts/benchmark-accessory-resize.mjs
```

Playwright's installed Chromium is the default. Set
`ADMIN_E2E_CHROMIUM_EXECUTABLE` to use another installed Chromium executable.
`BENCH_PARAGRAPHS` defaults to 80 and `BENCH_TASKS` to 40; use 1/40 for the
minimized linked-task reproduction. Run measurements sequentially, without
builds or other browser tests competing for the CPU.

The benchmark opens an issue through the accessory entity picker, applies 4x CPU
throttling, and performs 120 real pointer moves. It prints frame/input percentiles
and long-task counts; it fails if fewer than 100 input events occur or either
95th percentile exceeds 32ms or any frame exceeds 80ms. The maximum-frame guard catches rare breakpoint freezes that a percentile can hide. Keep the browser/build/CPU conditions fixed when
comparing before and after results. It closes its browser; stopping the owned
runtime removes its fixtures.
