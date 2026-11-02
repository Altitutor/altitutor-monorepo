/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions":["browser"]}
 */
import type * as BrowserSentry from "@sentry/nextjs";

let sdk: typeof BrowserSentry;
let requests: string[];
const originalEnv = process.env;
const originalFetch = globalThis.fetch;
const ingestion = jest.fn(
  async (_input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(String(init?.body ?? ""));
    return {
      status: 200,
      headers: new Headers(),
      text: async () => "{}",
    } as Response;
  },
);

const performanceMethods = [
  "getEntries",
  "getEntriesByType",
  "getEntriesByName",
] as const;
const performanceDescriptors = performanceMethods.map((name) =>
  Object.getOwnPropertyDescriptor(performance, name),
);
beforeAll(() => {
  globalThis.fetch = ingestion;
  for (const name of performanceMethods)
    Object.defineProperty(performance, name, {
      configurable: true,
      value: () => [],
    });
});
afterEach(async () => {
  await sdk.close(2000);
  process.env = originalEnv;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  performanceMethods.forEach((name, index) => {
    const descriptor = performanceDescriptors[index];
    if (descriptor) Object.defineProperty(performance, name, descriptor);
    else Reflect.deleteProperty(performance, name);
  });
});

function initialize(env: Record<string, string> = {}) {
  requests = [];
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    NEXT_PUBLIC_SENTRY_DSN: "http://fixture@localhost:8771/1",
    NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT: "production",
    NEXT_PUBLIC_SENTRY_DISABLED: "",
    NEXT_PUBLIC_SENTRY_TEST_OPT_IN: "",
    ...env,
  };
  jest.isolateModules(() => {
    sdk = jest.requireActual<typeof BrowserSentry>("@sentry/nextjs");
    jest.requireActual("@/instrumentation-client");
  });
}

it("keeps automatic localhost errors quiet but still sends an explicit user bug report", async () => {
  initialize();
  sdk.captureException(new Error("Automatic localhost fixture failure"));
  await sdk.flush(2000);
  expect(requests).toEqual([]);
  sdk.captureFeedback({ message: "Explicit fixture bug report" });
  await sdk.flush(2000);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain("Explicit fixture bug report");
});

it("reports the opted-in unexpected browser failure only once", async () => {
  initialize({ NEXT_PUBLIC_SENTRY_TEST_OPT_IN: "true" });
  const error = new Error("Opted-in browser fixture failure");
  sdk.captureException(error);
  sdk.captureException(error);
  await sdk.flush(2000);
  expect(
    requests.filter((body) =>
      body.includes("Opted-in browser fixture failure"),
    ),
  ).toHaveLength(1);
});

it("honors the kill switch for both automatic errors and explicit feedback", async () => {
  initialize({
    NEXT_PUBLIC_SENTRY_DISABLED: "true",
    NEXT_PUBLIC_SENTRY_TEST_OPT_IN: "true",
  });
  sdk.captureException(new Error("Disabled browser fixture failure"));
  sdk.captureFeedback({ message: "Disabled explicit fixture report" });
  await sdk.flush(2000);
  expect(requests).toEqual([]);
});
