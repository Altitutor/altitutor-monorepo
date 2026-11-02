import { NextRequest } from "next/server";

describe("UCAT proxy origins", () => {
  const originalEnvironment = process.env;

  afterEach(() => {
    Object.defineProperty(process, "env", {
      value: originalEnvironment,
      writable: true,
    });
    jest.restoreAllMocks();
  });

  it.each([
    { privateOrigin: "http://127.0.0.1:41004", publicOrigin: "http://127.0.0.1:42004", genericOrigin: "http://127.0.0.1:43004", expected: "http://127.0.0.1:41004" },
    { privateOrigin: "", publicOrigin: "http://127.0.0.1:42004", genericOrigin: "http://127.0.0.1:43004", expected: "http://127.0.0.1:42004" },
    { privateOrigin: "", publicOrigin: "", genericOrigin: "http://127.0.0.1:43004", expected: "http://127.0.0.1:43004" },
    { privateOrigin: "", publicOrigin: "", genericOrigin: "", expected: "http://localhost:3004" },
  ])("routes pricing and interest to $expected", async ({ privateOrigin, publicOrigin, genericOrigin, expected }) => {
    Object.defineProperty(process, "env", {
      value: {
        ...originalEnvironment,
        NODE_ENV: "development",
        UCAT_APP_ORIGIN: privateOrigin,
        NEXT_PUBLIC_UCAT_APP_ORIGIN: publicOrigin,
        NEXT_PUBLIC_UCAT_URL: genericOrigin,
      },
      writable: true,
    });
    jest.resetModules();
    const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response("{}", { headers: { "Content-Type": "application/json" } }),
    );
    const pricing = await import("../subscription-config/route");
    expect((await pricing.GET()).status).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith(`${expected}/api/ucat/subscription-config`, expect.any(Object));

    const interest = await import("../interest/route");
    const request = new NextRequest("http://127.0.0.1/api/ucat/interest", {
      method: "POST",
      body: JSON.stringify({ email: "local@example.test" }),
    });
    expect((await interest.POST(request)).status).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith(`${expected}/api/ucat/public-interest`, expect.objectContaining({ method: "POST" }));
  });
});
