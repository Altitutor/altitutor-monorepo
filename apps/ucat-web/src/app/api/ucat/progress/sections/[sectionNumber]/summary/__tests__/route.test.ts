import { GET } from "@/app/api/ucat/progress/sections/[sectionNumber]/summary/route";
import { getSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

type QueryRecord = {
  table: string;
  selected: string | null;
  filters: Map<string, unknown>;
};
type QueryResult = { data: unknown; error: null };
type QueryChain = {
  select: jest.Mock<QueryChain, [string]>;
  eq: jest.Mock<QueryChain, [string, unknown]>;
  maybeSingle: jest.Mock<Promise<QueryResult>, []>;
  then: (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);

describe("GET /api/ucat/progress/sections/[sectionNumber]/summary", () => {
  it("filters available sets by their authored section in the database", async () => {
    const records: QueryRecord[] = [];
    const resultFor = (table: string): QueryResult => {
      if (table === "vstudent_ucat_sections") {
        return {
          data: {
            id: "section-2",
            name: "Decision Making",
            section_number: 2,
          },
          error: null,
        };
      }
      if (table === "vstudent_ucat_section_set_progress") {
        return {
          data: {
            total_completed: 1,
            untimed_completed: 1,
            timed_completed: 0,
          },
          error: null,
        };
      }
      if (table === "vstudent_ucat_question_sets") {
        return {
          data: [
            { time_limit_seconds: null },
            { time_limit_seconds: 1200 },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    };
    const from = jest.fn((table: string) => {
      const record: QueryRecord = {
        table,
        selected: null,
        filters: new Map(),
      };
      records.push(record);
      const chain: QueryChain = {
        select: jest.fn((selected: string) => {
          record.selected = selected;
          return chain;
        }),
        eq: jest.fn((column: string, value: unknown) => {
          record.filters.set(column, value);
          return chain;
        }),
        maybeSingle: jest.fn(async () => resultFor(table)),
        then: (
          resolve: (value: QueryResult) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(resultFor(table)).then(resolve, reject),
      };
      return chain;
    });
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
    } as never);

    const response = await GET({} as Request, {
      params: Promise.resolve({ sectionNumber: "2" }),
    });
    const payload = await response.json();
    const setsQuery = records.find(
      (record) => record.table === "vstudent_ucat_question_sets",
    );

    expect(response.status).toBe(200);
    expect(setsQuery).toEqual(
      expect.objectContaining({ selected: "time_limit_seconds" }),
    );
    expect(setsQuery?.filters.get("section_number")).toBe(2);
    expect(setsQuery?.filters.get("is_available_in_sets_library")).toBe(true);
    expect(payload).toMatchObject({
      totalPublicSets: 2,
      totalPublicUntimedSets: 1,
      totalPublicTimedSets: 1,
    });
  });
});
