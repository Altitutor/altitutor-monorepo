/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import type { NextRequest } from "next/server";
import { GET } from "@/app/api/bookings/trial/[sessionId]/route";
import { createServiceRoleClient } from "../public-booking-guards";

jest.mock("@/lib/sentry/instrument-supabase-client", () => ({
  instrumentSupabaseClient: (client: unknown) => client,
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("../public-booking-guards", () => ({
  ...jest.requireActual("../public-booking-guards"),
  createServiceRoleClient: jest.fn(),
}));

const sessionId = "10000000-0000-4000-8000-000000000001";
const students = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    first_name: "First",
    last_name: "Student",
    email: "first@example.test",
    phone: null,
    curriculum: "SACE",
    year_level: 12,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    first_name: "Second",
    last_name: "Student",
    email: "second@example.test",
    phone: null,
    curriculum: "SACE",
    year_level: 11,
  },
];

interface FixtureOptions {
  retired?: boolean;
  count?: number;
  revoked?: boolean;
  completed?: boolean;
  absentSecondStudent?: boolean;
}

function fixtureClient({
  retired = false,
  count = 2,
  revoked = false,
  completed = false,
  absentSecondStudent = false,
}: FixtureOptions = {}) {
  const rows = students.slice(0, count).map(student => ({ ...student, deleted_at: retired ? '2026-01-01T00:00:00Z' : null }));
  return createClient<Database>(
    "https://booking-fixture.invalid",
    "test-only",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          const url = new URL(String(input));
          let body: unknown;
          if (url.pathname.endsWith("/rpc/service_is_public_link_revoked"))
            body = revoked;
          else if (url.pathname.endsWith("/sessions_students")) {
            body = rows
              .filter(
                (_, index) =>
                  !(
                    absentSecondStudent &&
                    index === 1 &&
                    url.searchParams.get("planned_absence") === "eq.false"
                  ),
              )
              .map((student) => ({ student_id: student.id }));
          } else if (url.pathname.endsWith("/sessions")) {
            body = {
              id: sessionId,
              type: "TRIAL_SESSION",
              status: "ACTIVE",
              start_at: completed
                ? "2000-01-01T04:50:00Z"
                : "2099-01-01T04:50:00Z",
              end_at: completed
                ? "2000-01-01T05:30:00Z"
                : "2099-01-01T05:30:00Z",
              subject_id: null,
            };
          } else if (url.pathname.endsWith("/students_subjects")) body = [];
          else if (url.pathname.endsWith("/students")) {
            const filter = url.searchParams.get("id") ?? "";
            // Deliberately return a different DB order from enrollment order.
            body = filter.startsWith("in.")
              ? rows.filter((student) => filter.includes(student.id)).reverse()
              : rows.find((student) => filter === `eq.${student.id}`);
          } else throw new Error("Unexpected fixture endpoint");
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    },
  );
}

// Actual route, loader and Supabase/PostgREST client; only HTTP transport is replaced.
// Two active enrollments reproduce the original production incident.
describe("public booking lookup with multiple students", () => {
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  });
  afterAll(() => {
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  it('rejects an old booking link for a deleted Student', async () => {
    const response = await load({ retired: true });
    expect(response.status).toBe(404);
  });

  async function load(options: FixtureOptions = {}, identifier = sessionId) {
    jest
      .mocked(createServiceRoleClient)
      .mockReturnValue(fixtureClient(options));
    return GET({} as NextRequest, { params: Promise.resolve({ sessionId: identifier }) });
  }

  it.each([1, 2])(
    "loads an existing trial with %i active enrollments",
    async (count) => {
      const response = await load({ count });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          session_id: sessionId,
          student_first_name: "First",
          student_email: "first@example.test",
          students: students
            .slice(0, count)
            .map(({ first_name, last_name }) => ({ first_name, last_name })),
        }),
      );
    },
  );

  it("also resolves a durable token for the shared session", async () => {
    const response = await load({}, "synthetic-booking-token");
    expect(response.status).toBe(200);
    expect((await response.json()).students).toHaveLength(2);
  });

  it("does not include a student marked absent", async () => {
    const response = await load({ absentSecondStudent: true });
    expect(response.status).toBe(200);
    expect((await response.json()).students).toEqual([
      { first_name: "First", last_name: "Student" },
    ]);
  });

  it("returns minimal names without contact details for completed bookings", async () => {
    const response = await load({ completed: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        is_terminal: true,
        student_email: "",
        student_last_name: "",
        curriculum: "",
        students: [
          { first_name: "First", last_name: "" },
          { first_name: "Second", last_name: "" },
        ],
      }),
    );
  });

  it("rejects revoked links", async () => {
    expect((await load({ revoked: true })).status).toBe(410);
  });

  it("rejects sessions without active enrollments", async () => {
    expect((await load({ count: 0 })).status).toBe(404);
  });
});
