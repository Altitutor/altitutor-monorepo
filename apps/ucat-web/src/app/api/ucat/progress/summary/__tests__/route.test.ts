import { GET } from "@/app/api/ucat/progress/summary/route";
import { getSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (
      body: unknown,
      init?: { status?: number; headers?: HeadersInit },
    ) => ({
      status: init?.status ?? 200,
      headers: new Headers(init?.headers),
      json: async () => body,
    }),
  },
}));

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);

describe("GET /api/ucat/progress/summary", () => {
  it("loads all section totals through one student-first aggregate RPC", async () => {
    const summary = {
      sectionProgress: [
        {
          sectionId: "section-1",
          sectionName: "Verbal Reasoning",
          sectionNumber: 1,
          correctScore: 42,
          maxScore: 50,
          percentage: 84,
          totalPublicQuestions: 1200,
        },
      ],
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

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_student_ucat_progress_summary");
    expect(from).not.toHaveBeenCalled();
  });
});
