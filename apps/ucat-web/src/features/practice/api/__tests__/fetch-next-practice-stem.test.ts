import {
  fetchDeliveredPracticeStem,
  fetchNextPracticeStem,
} from "../fetch-next-practice-stem";

describe("fetchNextPracticeStem", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function response(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn(async () => body),
    } as unknown as Response;
  }

  it("returns null only for a successful exhausted response", async () => {
    global.fetch = jest.fn(async () => response(200, { stem: null }));

    await expect(
      fetchNextPracticeStem("session-1", {} as never, []),
    ).resolves.toBeNull();
  });

  it("does not misclassify a concurrency conflict as exhaustion", async () => {
    global.fetch = jest.fn(async () =>
      response(409, { error: "Concurrent delivery" }),
    );

    await expect(
      fetchNextPracticeStem("session-1", {} as never, []),
    ).rejects.toEqual(expect.objectContaining({
      name: "PracticeStemRequestError",
      status: 409,
    }));
  });

  it("does not misclassify a server failure as exhaustion", async () => {
    global.fetch = jest.fn(async () =>
      response(500, { error: "Database unavailable" }),
    );

    await expect(
      fetchNextPracticeStem("session-1", {} as never, []),
    ).rejects.toEqual(expect.objectContaining({ status: 500 }));
  });

  it("reconciles a superseded preview through normal delivery once", async () => {
    const deliveredStem = { id: "stem-3" };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(409, { error: "Concurrent delivery" }))
      .mockResolvedValueOnce(response(200, { stem: deliveredStem }));

    await expect(
      fetchDeliveredPracticeStem(
        "session-1",
        {} as never,
        ["stem-1"],
        "stem-2",
      ),
    ).resolves.toEqual(deliveredStem);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
