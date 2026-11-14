/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { Database } from "@altitutor/shared";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { instrumentSupabaseClient } from "@/lib/sentry/instrument-supabase-client";
import { topicsFilesApi } from "../topics-files";

jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: jest.fn(),
}));

const events: Sentry.ErrorEvent[] = [];
const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const topicFile = {
  id: "topic-file-1",
  topic_id: "topic-1",
  file_id: "file-1",
  file: { id: "file-1", storage_path: "fixture/resource.pdf" },
};

beforeAll(() => {
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.example/1";
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    defaultIntegrations: false,
    tracesSampleRate: 0,
    sendClientReports: false,
    transport: () => ({
      send: async () => {
        throw new Error("Test must not send telemetry");
      },
      flush: async () => true,
    }),
    beforeSend: (event) => {
      events.push(event);
      return null;
    },
  });
});
beforeEach(() => {
  events.length = 0;
});
afterEach(async () => {
  await Sentry.flush(1000);
  jest.restoreAllMocks();
});
afterAll(async () => {
  await Sentry.close();
  if (originalDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
});

function installClient(
  initialRows = [topicFile],
  failure?: { code: string; message: string },
) {
  let rows = initialRows;
  const requests: Array<{ method: string; path: string; status: number }> = [];
  const client = createClient<Database>(
    "https://database.example",
    "fixture-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input));
          const method = init?.method ?? "GET";
          const respond = (body: unknown, status: number) => {
            requests.push({ method, path: url.pathname, status });
            return new Response(status === 204 ? null : JSON.stringify(body), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          };
          if (url.pathname === "/rest/v1/topics_files") {
            expect(url.searchParams.get("id")).toBe("eq.topic-file-1");
            if (method === "DELETE") {
              rows = [];
              return respond(null, 204);
            }
            if (failure) return respond(failure, 403);
            // PostgREST object responses require exactly one row; array responses allow zero.
            if (
              new Headers(init?.headers).get("Accept") ===
              "application/vnd.pgrst.object+json"
            ) {
              return rows.length === 1
                ? respond(rows[0], 200)
                : respond(
                    {
                      code: "PGRST116",
                      message:
                        "Cannot coerce the result to a single JSON object",
                      details: `The result contains ${rows.length} rows`,
                      hint: null,
                    },
                    406,
                  );
            }
            return respond(rows, 200);
          }
          if (method === "DELETE" && url.pathname === "/rest/v1/files") {
            expect(url.searchParams.get("id")).toBe("eq.file-1");
            return respond(null, 204);
          }
          if (
            method === "DELETE" &&
            url.pathname === "/storage/v1/object/resources"
          ) {
            return respond([], 200);
          }
          throw new Error(`Unexpected request: ${method} ${url.pathname}`);
        },
      },
    },
  );
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(instrumentSupabaseClient(client));
  return requests;
}

it("returns the existing topic file", async () => {
  installClient();
  await expect(
    topicsFilesApi.getTopicFile(topicFile.id),
  ).resolves.toMatchObject({ id: topicFile.id });
});

it("returns null without an HTTP or Sentry error when the topic file is absent", async () => {
  const requests = installClient([]);
  await expect(topicsFilesApi.getTopicFile(topicFile.id)).resolves.toBeNull();
  await Sentry.flush(1000);
  expect(requests.map(({ status }) => status)).toEqual([200]);
  expect(events).toEqual([]);
});

it("keeps successful deletion successful when an active detail observer refetches", async () => {
  const requests = installClient();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const observer = new QueryObserver(queryClient, {
    queryKey: ["topics-files", topicFile.id],
    queryFn: () => topicsFilesApi.getTopicFile(topicFile.id),
  });
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    await observer.refetch();
    expect(observer.getCurrentResult().data?.id).toBe(topicFile.id);
    await expect(
      topicsFilesApi.deleteTopicFile(topicFile.id),
    ).resolves.toBeUndefined();
    // useDeleteTopicFile invalidates this prefix while detail observers can remain mounted.
    await queryClient.invalidateQueries({ queryKey: ["topics-files"] });
    expect(observer.getCurrentResult()).toMatchObject({
      status: "success",
      data: null,
    });
    await Sentry.flush(1000);
    expect(requests.slice(-4)).toEqual([
      { method: "DELETE", path: "/rest/v1/topics_files", status: 204 },
      { method: "DELETE", path: "/rest/v1/files", status: 204 },
      { method: "DELETE", path: "/storage/v1/object/resources", status: 200 },
      { method: "GET", path: "/rest/v1/topics_files", status: 200 },
    ]);
    expect(events).toEqual([]);
  } finally {
    unsubscribe();
    queryClient.clear();
  }
});

it("rejects duplicate-row integrity failures instead of treating them as absence", async () => {
  installClient([topicFile, topicFile]);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  await expect(topicsFilesApi.getTopicFile(topicFile.id)).rejects.toMatchObject(
    { code: "PGRST116" },
  );
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
});

it("preserves genuine query errors", async () => {
  const failure = {
    code: "42501",
    message: "permission denied for table topics_files",
  };
  installClient([], failure);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  await expect(topicsFilesApi.getTopicFile(topicFile.id)).rejects.toMatchObject(
    failure,
  );
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
});
