import * as Sentry from "@sentry/nextjs";

jest.mock("@sentry/nextjs", () => ({
  init: jest.fn(),
  addBreadcrumb: jest.fn(),
  replayIntegration: jest.fn(() => ({ name: "Replay" })),
  feedbackIntegration: jest.fn(() => ({ name: "Feedback" })),
  captureRouterTransitionStart: jest.fn(),
}));

const originalEnv = process.env;
beforeEach(() => {
  history.replaceState(null, "", "/login");
  window.__ucatChunkDiagnostics = {
    records: [
      {
        at: Date.now(),
        kind: "resource-error",
        chunk: "error-b4575bcab245af82.js",
      },
    ],
  };
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    NEXT_PUBLIC_SENTRY_DSN: "https://public@sentry.example/1",
    NEXT_PUBLIC_SENTRY_DISABLED: "",
    NEXT_PUBLIC_SENTRY_TEST_OPT_IN: "true",
  };
});
afterEach(() => {
  process.env = originalEnv;
  delete window.__ucatChunkDiagnostics;
  jest.clearAllMocks();
});

function initialize() {
  jest.isolateModules(() => jest.requireActual("@/instrumentation-client"));
  const options = jest.mocked(Sentry.init).mock.calls.at(-1)?.[0];
  return options!;
}

it("wires native context into existing chunk captures and the replay hydration marker", () => {
  const options = initialize();
  const event: Sentry.ErrorEvent = {
    type: undefined,
    exception: {
      values: [{ type: "ChunkLoadError", value: "Loading chunk 7601 failed." }],
    },
  };
  const enriched = options.beforeSend?.(event, {}) as Sentry.ErrorEvent;
  expect(enriched.contexts?.ucat_chunk_diagnostics).toMatchObject({
    records: [{ kind: "resource-error", chunk: "error-b4575bcab245af82.js" }],
  });
  const integrations = options.integrations as (defaults: []) => unknown;
  integrations([]);
  const replay = jest.mocked(Sentry.replayIntegration).mock.calls.at(-1)?.[0];
  const marker = {
    type: 5 as const,
    timestamp: Date.now(),
    data: {
      tag: "breadcrumb" as const,
      payload: {
        category: "replay.hydrate-error" as const,
        type: "default",
        timestamp: Date.now() / 1000,
        data: { url: "https://fixture.invalid/login" },
      },
    },
  };
  const recorded = replay?.beforeAddRecordingEvent?.(marker) as typeof marker;
  expect(recorded.data.payload.data).toMatchObject({
    ucat_chunk_diagnostics: { records: [{ kind: "resource-error" }] },
  });
  expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining({ category: "ucat.chunk" }),
  );
});

it("retains mobile auth telemetry suppression instead of enriching private flows", () => {
  history.replaceState(
    null,
    "",
    "/login?redirect=%252Fmobile-auth%253Fticket%253Dprivate",
  );
  const options = initialize();
  const event: Sentry.ErrorEvent = {
    type: undefined,
    exception: {
      values: [{ type: "ChunkLoadError", value: "Loading chunk 7601 failed." }],
    },
  };
  expect(options.beforeSend?.(event, {})).toBeNull();
  expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  const integrations = options.integrations as (defaults: []) => unknown;
  integrations([]);
  expect(Sentry.replayIntegration).not.toHaveBeenCalled();
});
