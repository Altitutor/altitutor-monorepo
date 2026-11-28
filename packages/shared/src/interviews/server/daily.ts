/** Server-only Daily adapter. Keep API credentials out of public environment variables. */
export class DailyProviderError extends Error {
  constructor(readonly status: number) {
    super(`Interview media provider request failed (${status}).`);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid interview media provider response.");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value)
    throw new Error("Invalid interview media provider response.");
  return value;
}

export class DailyInterviewProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("Online interviews are not configured.");
  }
  private async request(
    path: string,
    method = "GET",
    body?: unknown,
    timeoutMs = 10_000,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetcher(`https://api.daily.co/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new DailyProviderError(response.status);
    if (response.status === 204) return {};
    return object(await response.json());
  }
  async createRoom(name: string, expires: number, maxParticipants = 8): Promise<string> {
    const room = await this.request("/rooms", "POST", {
      name,
      privacy: "private",
      properties: {
        exp: expires,
        eject_at_room_exp: true,
        max_participants: maxParticipants,
        enforce_unique_user_ids: true,
        enable_chat: false,
        enable_screenshare: false,
        enable_knocking: false,
        permissions: {
          canSend: false,
          canReceive: { base: false },
          canAdmin: false,
        },
      },
    });
    const url = string(room.url);
    if (
      new URL(url).protocol !== "https:" ||
      !new URL(url).hostname.endsWith(".daily.co")
    )
      throw new Error("Invalid Daily room URL.");
    return url;
  }
  async token(
    room: string,
    actorId: string,
    name: string,
    expires: number,
    permissions: { canSend: boolean; canReceive: boolean },
  ): Promise<string> {
    const result = await this.request("/meeting-tokens", "POST", {
      properties: {
        room_name: room,
        user_id: actorId,
        user_name: name,
        is_owner: false,
        exp: expires,
        eject_at_token_exp: true,
        enable_screenshare: false,
        enable_recording_ui: false,
        permissions: {
          canSend: permissions.canSend ? ["audio", "video"] : false,
          canReceive: { base: permissions.canReceive },
          canAdmin: false,
        },
      },
    });
    return string(result.token);
  }
  async closeRoom(room: string): Promise<void> {
    const deleteRoom = async () => {
      try {
        // Deletion denies old credentials and ejects connected participants.
        await this.request(`/rooms/${encodeURIComponent(room)}`, "DELETE", undefined, 4_000);
      } catch (error) {
        if (!(error instanceof DailyProviderError) || error.status !== 404)
          throw error;
      }
    };

    try {
      await deleteRoom();
    } catch (error) {
      const transient = error instanceof DailyProviderError
        ? error.status >= 500 && error.status <= 599
        : error instanceof TypeError || (error instanceof DOMException && error.name === "TimeoutError");
      if (!transient) throw error;

      // Retry an idempotent retirement once within the current request. A
      // repeated failure still uses the worker's durable backoff.
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      await deleteRoom();
    }
  }
  async recordings(
    room: string,
  ): Promise<
    Array<{
      id: string;
      state: "recording" | "ready" | "failed";
      createdAt: string;
    }>
  > {
    const result = await this.request(
      `/recordings?room_name=${encodeURIComponent(room)}&limit=100`,
    );
    if (!Array.isArray(result.data))
      throw new Error("Invalid Daily recordings response.");
    return result.data.map((value: unknown) => {
      const recording = object(value);
      if (typeof recording.start_ts !== "number")
        throw new Error("Invalid Daily recording timestamp.");
      return {
        id: string(recording.id),
        state:
          recording.status === "finished"
            ? "ready"
            : recording.status === "in-progress"
              ? "recording"
              : "failed",
        createdAt: new Date(recording.start_ts * 1000).toISOString(),
      };
    });
  }
  async recordingLink(id: string): Promise<string> {
    const result = await this.request(
      `/recordings/${encodeURIComponent(id)}/access-link?valid_for_secs=900`,
    );
    const url = string(result.download_link);
    if (new URL(url).protocol !== "https:")
      throw new Error("Invalid Daily recording URL.");
    return url;
  }
  async deleteRecording(id: string): Promise<void> {
    try {
      await this.request(`/recordings/${encodeURIComponent(id)}`, "DELETE");
    } catch (error) {
      if (!(error instanceof DailyProviderError) || error.status !== 404)
        throw error;
    }
  }
}
