import { DailyInterviewProvider } from "../server/daily";

describe("Daily interview adapter", () => {
  it("deletes the room so its credentials cannot join again", async () => {
    const request = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await new DailyInterviewProvider("test", request).closeRoom("phase-room");
    expect(request).toHaveBeenCalledWith(
      "https://api.daily.co/v1/rooms/phase-room",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
  it("retries a transient room deletion failure before handing off to the worker", async () => {
    const request = jest.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await new DailyInterviewProvider("test", request).closeRoom("phase-room");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("accepts an already-deleted room after a network failure", async () => {
    const request = jest.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    await new DailyInterviewProvider("test", request).closeRoom("phase-room");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("retries a timed-out delete, but does not retry request cancellation", async () => {
    const request = jest.fn()
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    await expect(new DailyInterviewProvider("test", request).closeRoom("phase-room"))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 429])("does not immediately retry a provider %i response", async (status) => {
    const request = jest.fn().mockResolvedValue(new Response(null, { status }));
    await expect(new DailyInterviewProvider("test", request).closeRoom("phase-room"))
      .rejects.toMatchObject({ status });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("returns a repeated provider failure for durable backoff", async () => {
    const request = jest.fn().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(new DailyInterviewProvider("test", request).closeRoom("phase-room"))
      .rejects.toMatchObject({ status: 503 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("creates a private room with expiry enforced by the provider and issues restricted non-owner tokens", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: "interview-room",
            url: "https://example.daily.co/interview-room",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "scoped-token" })),
      );
    const provider = new DailyInterviewProvider("server-secret", request);
    await provider.createRoom("interview-room", 1900000000);
    await provider.token("interview-room", "student", "Student", 1900000000, {
      canSend: true,
      canReceive: false,
    });
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({
      privacy: "private",
      properties: {
        exp: 1900000000,
        eject_at_room_exp: true,
        max_participants: 8,
      },
    });
    expect(JSON.parse(request.mock.calls[0][1].body).properties).not.toHaveProperty("enable_recording");
    expect(JSON.parse(request.mock.calls[1][1].body).properties).not.toHaveProperty("start_cloud_recording");
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
      properties: {
        room_name: "interview-room",
        user_id: "student",
        is_owner: false,
        eject_at_token_exp: true,
        exp: 1900000000,
        permissions: {
          canSend: ["audio", "video"],
          canReceive: { base: false },
          canAdmin: false,
        },
      },
    });
  });
});
