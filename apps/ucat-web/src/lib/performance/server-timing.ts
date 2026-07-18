type TimingEntry = { name: string; durationMs: number };

function safeMetricName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class ServerTiming {
  private readonly startedAt = performance.now();
  private lastMark = this.startedAt;
  private readonly entries: TimingEntry[] = [];

  mark(name: string): void {
    const now = performance.now();
    this.entries.push({
      name: safeMetricName(name),
      durationMs: now - this.lastMark,
    });
    this.lastMark = now;
  }

  apply(response: Response): Response {
    const totalMs = performance.now() - this.startedAt;
    const value = [
      ...this.entries.map(
        ({ name, durationMs }) => `${name};dur=${durationMs.toFixed(1)}`,
      ),
      `total;dur=${totalMs.toFixed(1)}`,
    ].join(", ");
    response.headers.set("Server-Timing", value);
    return response;
  }
}
