/** @jest-environment node */
import { NextResponse } from "next/server";
import { GET } from "@/app/api/interviews/active/route";
import { interviewApiError, interviewResponse, requireInterviewAccess, resolveInterviewActor } from "../context";

jest.mock("../context", () => ({
  resolveInterviewActor: jest.fn(),
  requireInterviewAccess: jest.fn(),
  interviewResponse: jest.fn((body: unknown) => Response.json(body, {
    headers: { "Cache-Control": "private, no-store" },
  })),
  interviewApiError: jest.fn(() => Response.json({ error: "Unavailable" }, { status: 503 })),
}));

const id = "22222222-2222-4222-8222-222222222222";
const order = jest.fn();
const select = jest.fn(() => ({ order }));
const from = jest.fn(() => ({ select }));
const request = () => new Request("https://portal.test/api/interviews/active");

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolveInterviewActor).mockResolvedValue({
    userId: "11111111-1111-4111-8111-111111111111",
    userClient: { from },
  } as unknown as Awaited<ReturnType<typeof resolveInterviewActor>>);
  jest.mocked(requireInterviewAccess).mockResolvedValue(null);
  order.mockResolvedValue({ data: [{ id, name: "Current interview" }], error: null });
});

it("returns the same rejoin links using only the minimal active-round read", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([{ id, name: "Current interview", href: `/interviews/rounds/${id}/live` }]);
  expect(from.mock.calls).toEqual([["vtutor_interview_active_rounds"]]);
  expect(select).toHaveBeenCalledWith("id,name");
  expect(order).toHaveBeenCalledWith("id");
  expect(response.headers.get("cache-control")).toContain("no-store");
});


it("keeps unauthenticated requests outside the discovery query", async () => {
  const denied = NextResponse.json({ error: "Sign in" }, { status: 401 });
  jest.mocked(resolveInterviewActor).mockResolvedValue({ response: denied });
  expect(await GET(request())).toBe(denied);
  expect(requireInterviewAccess).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

it("keeps the current interview entitlement check authoritative", async () => {
  const denied = NextResponse.json({ error: "No access" }, { status: 403 });
  jest.mocked(requireInterviewAccess).mockResolvedValue(denied);
  expect(await GET(request())).toBe(denied);
  expect(from).not.toHaveBeenCalled();
});

it("returns no rejoin links when no rounds are active", async () => {
  order.mockResolvedValue({ data: null, error: null });
  expect(await (await GET(request())).json()).toEqual([]);
});

it("preserves the legacy name fallback and ignores invalid identities", async () => {
  order.mockResolvedValue({ data: [{ id, name: null }, { id: null, name: "Invalid" }], error: null });
  expect(await (await GET(request())).json()).toEqual([{ id, name: "Mock interview", href: `/interviews/rounds/${id}/live` }]);
});

it("reports database failure without publishing stale active links", async () => {
  const error = { code: "57014", message: "Query timeout" };
  order.mockResolvedValue({ data: null, error });
  expect((await GET(request())).status).toBe(503);
  expect(interviewApiError).toHaveBeenCalledWith(error);
  expect(interviewResponse).not.toHaveBeenCalled();
});
