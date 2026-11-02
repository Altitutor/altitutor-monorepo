import { POST } from "./route";
import type { NextRequest } from "next/server";
const mockGetUser = jest.fn();
const mockStaff = jest.fn();
const mockRpc = jest.fn();
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/shared/lib/supabase/server-ssr", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({ select: () => ({ eq: () => ({ single: mockStaff }) }) }),
    rpc: mockRpc,
  }),
}));
const input = {
  type: "ADMIN_MEETING",
  startAt: "2026-10-29T00:00:00Z",
  endAt: "2026-10-29T01:00:00Z",
  studentIds: [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
  ],
  parentIds: [],
  staffIds: [],
  receiverStaffIds: [],
};
const request = () => ({ json: async () => input }) as NextRequest;
beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "admin" } } });
  mockStaff.mockResolvedValue({
    data: { id: "staff", role: "ADMINSTAFF", status: "ACTIVE" },
  });
  mockRpc.mockResolvedValue({ data: "created", error: null });
});
it("submits flexible participants through the atomic admin transaction", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sessionId: "created" });
  expect(mockRpc).toHaveBeenCalledWith(
    "create_admin_meeting",
    expect.objectContaining({
      p_student_ids: input.studentIds,
      p_staff_ids: [],
    }),
  );
});
it("rejects non-admin callers before creating a meeting", async () => {
  mockStaff.mockResolvedValue({
    data: { id: "tutor", role: "TUTOR", status: "ACTIVE" },
  });
  expect((await POST(request())).status).toBe(403);
  expect(mockRpc).not.toHaveBeenCalled();
});
it("rejects unauthenticated callers before querying staff", async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  expect((await POST(request())).status).toBe(401);
  expect(mockStaff).not.toHaveBeenCalled();
});
