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

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);

describe("GET /api/ucat/progress/sections/[sectionNumber]/summary", () => {
  it("loads the complete summary through one database aggregate RPC", async () => {
    const summary = {
      section: {
        sectionId: "section-2",
        sectionName: "Decision Making",
        sectionNumber: 2,
        correctScore: 4,
        maxScore: 5,
        percentage: 80,
        totalPublicQuestions: 100,
      },
      categoryProgress: [],
      totalPublicSets: 2,
      totalPublicUntimedSets: 1,
      totalPublicTimedSets: 1,
      setsCompleted: 1,
      untimedSetsCompleted: 1,
      timedSetsCompleted: 0,
    };
    const rpc = jest.fn().mockResolvedValue({ data: summary, error: null });
    const from = jest.fn();
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc,
      from,
    } as never);

    const response = await GET({} as Request, {
      params: Promise.resolve({ sectionNumber: "2" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "get_student_ucat_section_progress_summary",
      { p_section_number: 2 },
    );
    expect(from).not.toHaveBeenCalled();
  });
});
