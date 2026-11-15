/** @jest-environment node */
import { createAdminMcpHttpHandler } from "../http-handler";
import { runReportingQuery } from "../reporting";
import * as Sentry from "@sentry/nextjs";

jest.mock("../reporting", () => ({ runReportingQuery: jest.fn() }));

const url = "https://database.example.test";
const actor = "fixture-actor";
const token = `header.${Buffer.from(
  JSON.stringify({
    sub: actor,
    client_id: "fixture-client",
    iss: `${url}/auth/v1`,
    aud: "authenticated",
  }),
).toString("base64url")}.signature`;
const output = {
  rows: [{ marker: "private-report-result" }],
  columns: [{ name: "marker", postgresTypeOid: 25 }],
  returnedRows: 1,
  truncated: false,
  rowLimit: 1,
  catalogVersion: "fixture",
  queriedAt: "2026-11-13T00:00:00.000Z",
  elapsedMs: 0,
};
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let consent = true;
let expired = false;
let auditCode = "42501";
let testClock = Date.UTC(2026, 10, 13);
const calls: string[] = [];
const authorizations: string[] = [];
const diagnostics: Sentry.ErrorEvent[] = [];

beforeAll(() => {
  Sentry.init({
    dsn: "https://public@sentry.example/1",
    enabled: true,
    defaultIntegrations: false,
    sendClientReports: false,
    release: "fixture-release",
    environment: "fixture-environment",
    transport: () => ({
      send: async () => {
        throw new Error("Telemetry must stay local");
      },
      flush: async () => true,
    }),
    beforeSend: (event) => {
      diagnostics.push(event);
      return null;
    },
  });
});
afterAll(async () => {
  await Sentry.close();
});

beforeEach(() => {
  testClock += 120000;
  jest.useFakeTimers({ now: testClock });
  consent = true;
  expired = false;
  auditCode = "42501";
  calls.length = 0;
  authorizations.length = 0;
  diagnostics.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-key";
  jest
    .mocked(runReportingQuery)
    .mockReset()
    .mockImplementation(async () => {
      calls.push("query");
      return output;
    });
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const requestUrl = new URL(String(input));
    if (requestUrl.origin !== url)
      throw new Error("Unexpected external request");
    authorizations.push(new Headers(init?.headers).get("authorization") ?? "");
    const response = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (requestUrl.pathname === "/auth/v1/user") {
      calls.push("user");
      return expired
        ? response({ message: "JWT expired" }, 401)
        : response({ id: actor });
    }
    if (requestUrl.pathname === "/rest/v1/rpc/has_admin_mcp_access") {
      calls.push("consent");
      return response(consent);
    }
    if (requestUrl.pathname === "/rest/v1/rpc/admin_record_reporting_query") {
      calls.push("audit");
      jest.advanceTimersByTime(50);
      return consent
        ? response(null)
        : response(
            { code: auditCode, message: "Admin MCP consent required" },
            403,
          );
    }
    throw new Error(`Unexpected request path: ${requestUrl.pathname}`);
  });
});

afterEach(async () => {
  jest.useRealTimers();
  await Sentry.flush(1000);
  jest.restoreAllMocks();
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined)
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
});

async function invoke() {
  const response = await createAdminMcpHttpHandler()(
    new Request("https://admin.example.test/api/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "query_admin_reporting",
          arguments: { sql: "select 1 as fixture", rowLimit: 1 },
        },
      }),
    }),
  );
  const text = await response.text();
  const line = text.split("\n").find((value) => value.startsWith("data: "));
  return { response, body: JSON.parse(line ? line.slice(6) : text), text };
}

it("checks live consent and preserves the same OAuth token through reporting audit", async () => {
  const { response, body } = await invoke();
  expect(response.status).toBe(200);
  expect(body.result.structuredContent.result).toEqual(output);
  expect(calls).toEqual(["user", "consent", "query", "audit"]);
  expect(authorizations).toEqual([
    `Bearer ${token}`,
    `Bearer ${token}`,
    `Bearer ${token}`,
  ]);
});

it.each(["absent consent", "expired identity"])(
  "rejects %s before executing the report",
  async (state) => {
    consent = state !== "absent consent";
    expired = state === "expired identity";
    const { response } = await invoke();
    expect(response.status).toBe(401);
    expect(runReportingQuery).not.toHaveBeenCalled();
    expect(calls).not.toContain("audit");
    jest.useRealTimers();
    await Sentry.flush(1000);
    expect(diagnostics).toHaveLength(0);
  },
);

it("withholds query results if consent is revoked between verification and audit", async () => {
  jest.mocked(runReportingQuery).mockImplementation(async () => {
    calls.push("query");
    consent = false;
    return output;
  });
  const { response, body, text } = await invoke();
  expect(response.status).toBe(200);
  expect(body.result).toMatchObject({
    isError: true,
    content: [
      { type: "text", text: "Could not record this reporting request." },
    ],
  });
  expect(text).not.toContain("private-report-result");
  expect(calls).toEqual(["user", "consent", "query", "audit"]);
  expect(authorizations).toEqual([
    `Bearer ${token}`,
    `Bearer ${token}`,
    `Bearer ${token}`,
  ]);
});

it("captures only bounded stage/timing evidence after a post-query consent denial", async () => {
  Sentry.setUser({ id: "private-actor", email: "private@example.test" });
  Sentry.setContext("request_details", {
    sql: "private-sql",
    token: "private-bearer",
  });
  Sentry.addBreadcrumb({ message: "private-breadcrumb" });
  jest.mocked(runReportingQuery).mockImplementation(async () => {
    calls.push("query");
    jest.advanceTimersByTime(500);
    consent = false;
    return output;
  });
  const { body } = await invoke();
  expect(body.result.isError).toBe(true);
  jest.useRealTimers();
  await Sentry.flush(1000);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({
    message: "Admin MCP reporting audit diagnostic",
    release: "fixture-release",
    environment: "fixture-environment",
    contexts: {
      reporting_audit: {
        schema: 1,
        stage: "reporting_audit",
        code: "42501",
        verified_request_age_ms: 550,
        query_ms: 500,
        audit_ms: 50,
      },
    },
  });
  expect(JSON.stringify(diagnostics)).not.toMatch(
    /private-|Bearer|fixture-client|fixture-actor|database\.example/,
  );
});

function revokeDuringQuery() {
  jest.mocked(runReportingQuery).mockImplementation(async () => {
    calls.push("query");
    consent = false;
    return output;
  });
}

it("does not capture successful queries or pre-audit failures", async () => {
  await invoke();
  jest
    .mocked(runReportingQuery)
    .mockRejectedValue(new Error("Reporting query failed."));
  const { body } = await invoke();
  expect(body.result.content[0].text).toBe("Reporting query failed.");
  expect(calls.filter((call) => call === "audit")).toHaveLength(1);
  jest.useRealTimers();
  await Sentry.flush(1000);
  expect(diagnostics).toHaveLength(0);
});

it("does not forward arbitrary database error codes", async () => {
  auditCode = "private-error-detail";
  revokeDuringQuery();
  await invoke();
  jest.useRealTimers();
  await Sentry.flush(1000);
  expect(diagnostics[0].contexts?.reporting_audit?.code).toBe("unknown");
  expect(JSON.stringify(diagnostics)).not.toContain("private-error-detail");
});

it("preserves the rejected response when telemetry throws", async () => {
  const sentryClient = Sentry.getClient();
  expect(sentryClient).toBeDefined();
  const capture = jest
    .spyOn(sentryClient!, "captureEvent")
    .mockImplementation(() => {
      throw new Error("private-sink-error");
    });
  revokeDuringQuery();
  const { body, text } = await invoke();
  expect(capture).toHaveBeenCalledTimes(1);
  expect(body.result).toEqual({
    isError: true,
    content: [
      { type: "text", text: "Could not record this reporting request." },
    ],
  });
  expect(text).not.toMatch(/private-/);
});

it("respects disabled Sentry collection without changing the rejection", async () => {
  const sentryClient = Sentry.getClient();
  expect(sentryClient).toBeDefined();
  const options = sentryClient!.getOptions();
  jest
    .spyOn(sentryClient!, "getOptions")
    .mockReturnValue({ ...options, enabled: false });
  const capture = jest.spyOn(sentryClient!, "captureEvent");
  revokeDuringQuery();
  const { body } = await invoke();
  expect(body.result.isError).toBe(true);
  expect(capture).not.toHaveBeenCalled();
});

it("preserves the rejection when no telemetry client is configured", async () => {
  const scope = Sentry.getCurrentScope();
  const sentryClient = scope.getClient();
  scope.setClient(undefined);
  try {
    revokeDuringQuery();
    const { body } = await invoke();
    expect(body.result).toEqual({
      isError: true,
      content: [
        { type: "text", text: "Could not record this reporting request." },
      ],
    });
    expect(diagnostics).toHaveLength(0);
  } finally {
    scope.setClient(sentryClient);
  }
});

it("caps audit diagnostics at ten per minute and resumes in the next window", async () => {
  revokeDuringQuery();
  for (let index = 0; index < 12; index++) {
    consent = true;
    expect((await invoke()).body.result.isError).toBe(true);
  }
  jest.advanceTimersByTime(60000);
  consent = true;
  await invoke();
  jest.useRealTimers();
  await Sentry.flush(1000);
  expect(diagnostics).toHaveLength(11);
});
