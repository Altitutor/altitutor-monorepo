import * as Sentry from "@sentry/nextjs";
import { attachChunkDiagnostics } from "../chunk-diagnostics";
import { LOGIN_CHUNK_RECOVERY_SCRIPT } from "../login-chunk-recovery";

declare global {
  interface Window {
    __ucatChunkDiagnostics?: unknown;
  }
}

const cleanups: Array<() => void> = [];
beforeEach(() => {
  sessionStorage.clear();
  history.replaceState(null, "", "/practice");
  const OriginalObserver = global.MutationObserver;
  jest.spyOn(global, "MutationObserver").mockImplementation((callback) => {
    const observer = new OriginalObserver(callback);
    cleanups.push(() => observer.disconnect());
    return observer;
  });
  const add = window.addEventListener.bind(window);
  jest
    .spyOn(window, "addEventListener")
    .mockImplementation((type, callback, options) => {
      cleanups.push(() => window.removeEventListener(type, callback, options));
      add(type, callback, options);
    });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  delete window.__ucatChunkDiagnostics;
  document.body.innerHTML = "";
  jest.restoreAllMocks();
});

function failScript(url: string) {
  const script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);
  script.dispatchEvent(new Event("error"));
}

it("keeps a bounded allowlisted native chunk trace without serializing URL secrets", () => {
  window.eval(LOGIN_CHUNK_RECOVERY_SCRIPT);
  for (let index = 0; index < 9; index++) {
    failScript(
      `/_next/static/chunks/error-b4575bcab245af82.js?token=secret-${index}#private`,
    );
  }
  expect(window.__ucatChunkDiagnostics).toMatchObject({
    records: Array(6).fill({
      kind: "resource-error",
      chunk: "error-b4575bcab245af82.js",
      online: "online",
    }),
  });
  const serialized = JSON.stringify(window.__ucatChunkDiagnostics);
  expect(serialized).not.toMatch(
    /secret|private|token|localhost|https?:|\/practice/,
  );
});

it("distinguishes actual resource timing from an unknown HTTP status and observes React errors", () => {
  const source = `${location.origin}/_next/static/chunks/error-b4575bcab245af82.js?token=private`;
  Object.defineProperty(performance, "getEntriesByName", {
    configurable: true,
    value: () => [
      {
        responseStatus: 503,
        duration: 120010.4,
        transferSize: 900,
        encodedBodySize: 800,
        decodedBodySize: 1200,
      },
    ],
  });
  Object.defineProperty(performance, "getEntriesByType", {
    configurable: true,
    value: () => [{ type: "reload" }],
  });
  cleanups.push(() => {
    delete (performance as unknown as Record<string, unknown>).getEntriesByName;
    delete (performance as unknown as Record<string, unknown>).getEntriesByType;
  });
  window.eval(LOGIN_CHUNK_RECOVERY_SCRIPT);
  failScript(source);
  window.dispatchEvent(
    new ErrorEvent("error", {
      error: new Error(
        "Minified React error #423; https://react.dev/errors/423?args[]=private",
      ),
    }),
  );
  expect(window.__ucatChunkDiagnostics).toMatchObject({
    records: [
      {
        kind: "resource-error",
        navigation: "reload",
        timing: {
          responseStatus: 503,
          durationMs: 120010,
          transferBytes: 900,
          encodedBytes: 800,
          decodedBytes: 1200,
          transferHint: "transferred",
        },
      },
      { kind: "react-hydration", reactCode: "423" },
    ],
  });
  Object.defineProperty(performance, "getEntriesByName", {
    configurable: true,
    value: () => [
      {
        responseStatus: 0,
        duration: 0,
        transferSize: 0,
        encodedBodySize: 800,
        decodedBodySize: 1200,
      },
    ],
  });
  failScript(source);
  expect(window.__ucatChunkDiagnostics).toMatchObject({
    records: [
      expect.anything(),
      expect.anything(),
      { timing: { responseStatus: null, transferHint: "no-transfer" } },
    ],
  });
  expect(JSON.stringify(window.__ucatChunkDiagnostics)).not.toContain(
    "private",
  );
});

it("carries only revalidated recent diagnostics once and consumes persisted context", () => {
  const now = Date.now();
  sessionStorage.setItem(
    "ucat-chunk-diagnostics",
    JSON.stringify({
      version: 1,
      carry: 1,
      savedAt: now,
      records: [
        {
          at: now - 10,
          kind: "auto-reload",
          online: "offline",
          visibility: "hidden",
          navigation: "navigate",
          chunk: "error-b4575bcab245af82.js",
          raw: "private-token",
          timing: {
            responseStatus: 0,
            cookie: "private-cookie",
            durationMs: 500,
          },
        },
        { at: now - 600000, kind: "resource-error", online: "online" },
        { at: now, kind: "arbitrary-private-message", body: "private-body" },
      ],
    }),
  );
  window.eval(LOGIN_CHUNK_RECOVERY_SCRIPT);
  expect(window.__ucatChunkDiagnostics).toMatchObject({
    records: [
      {
        kind: "auto-reload",
        timing: { responseStatus: null, durationMs: 500 },
      },
    ],
  });
  expect(JSON.stringify(window.__ucatChunkDiagnostics)).not.toMatch(
    /private|cookie|body|raw/,
  );
  expect(sessionStorage.getItem("ucat-chunk-diagnostics")).toBeNull();
  window.eval(LOGIN_CHUNK_RECOVERY_SCRIPT);
  expect(window.__ucatChunkDiagnostics).toMatchObject({ records: [] });
});

it.each([
  { carry: 1, savedAt: Date.now() - 600000 },
  { carry: 2, savedAt: Date.now() },
])("drops expired or repeatedly carried state: %j", (state) => {
  sessionStorage.setItem(
    "ucat-chunk-diagnostics",
    JSON.stringify({
      version: 1,
      ...state,
      records: [{ at: Date.now(), kind: "resource-error" }],
    }),
  );
  window.eval(LOGIN_CHUNK_RECOVERY_SCRIPT);
  expect(window.__ucatChunkDiagnostics).toMatchObject({ records: [] });
});

it.each([
  "/login?redirect=%2Fmobile-auth%3Fticket%3Dprivate",
  "/login?redirect=%252Fmobile-browser%253Fcode%253Dprivate",
  "/login?redirect=%2Fapi%2Fauth%2Fnative%2Fexchange%3Ftoken%3Dprivate",
])(
  "collects no native diagnostics in an encoded mobile-auth context (%s)",
  (path) => {
    history.replaceState(null, "", path);
    sessionStorage.setItem("ucat-login-chunk-recovery", "1");
    window.eval(LOGIN_CHUNK_RECOVERY_SCRIPT);
    failScript("/_next/static/chunks/error-b4575bcab245af82.js?token=private");
    expect(window.__ucatChunkDiagnostics).toMatchObject({ records: [] });
    expect(sessionStorage.getItem("ucat-chunk-diagnostics")).toBeNull();
  },
);

it("enriches one existing SDK envelope without producing another error or leaking script queries", async () => {
  const envelopes: unknown[] = [];
  Sentry.init({
    dsn: "https://public@sentry.example/1",
    defaultIntegrations: false,
    sendClientReports: false,
    beforeSend: (event) => attachChunkDiagnostics(event),
    transport: () => ({
      send: async (envelope: unknown) => {
        envelopes.push(envelope);
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });
  try {
    window.eval(LOGIN_CHUNK_RECOVERY_SCRIPT);
    failScript(
      "/_next/static/chunks/error-b4575bcab245af82.js?token=private-token#private-fragment",
    );
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(0);
    const error = new Error("Loading chunk 7601 failed.");
    error.name = "ChunkLoadError";
    Sentry.captureException(error);
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(1);
    const envelope = JSON.parse(JSON.stringify(envelopes[0])) as [
      unknown,
      Array<[unknown, { contexts: Record<string, unknown> }]>,
    ];
    expect(envelope[1][0][1].contexts.ucat_chunk_diagnostics).toMatchObject({
      records: [{ kind: "resource-error", chunk: "error-b4575bcab245af82.js" }],
    });
    expect(
      JSON.stringify(envelope[1][0][1].contexts.ucat_chunk_diagnostics),
    ).not.toMatch(/private|token|fragment|http|localhost/);
  } finally {
    await Sentry.close();
  }
});

it("revalidates injected queue objects, limits serialized size and ignores stale context", () => {
  const event: Sentry.ErrorEvent = {
    type: undefined,
    exception: {
      values: [{ type: "ChunkLoadError", value: "Loading chunk 7601 failed." }],
    },
  };
  window.__ucatChunkDiagnostics = {
    records: Array(100).fill({
      at: Date.now(),
      kind: "chunk-error",
      chunk: "error-b4575bcab245af82.js",
      navigation: { toString: () => "reload", raw: "private-navigation" },
      raw: "private-body",
      timing: {
        responseStatus: 0,
        transferBytes: Number.POSITIVE_INFINITY,
        durationMs: -1,
        cookie: "private-cookie",
      },
    }),
  };
  const enriched = attachChunkDiagnostics(event);
  const serialized = JSON.stringify(enriched.contexts?.ucat_chunk_diagnostics);
  expect(serialized.length).toBeLessThanOrEqual(4096);
  expect(serialized).not.toMatch(/private|cookie|Infinity/);
  expect(enriched.contexts?.ucat_chunk_diagnostics).toMatchObject({
    records: Array(6).fill({
      navigation: "unknown",
      timing: { responseStatus: null },
    }),
  });
  window.__ucatChunkDiagnostics = {
    records: [{ at: Date.now() - 600000, kind: "chunk-error" }],
  };
  expect(attachChunkDiagnostics(event)).toBe(event);
});
