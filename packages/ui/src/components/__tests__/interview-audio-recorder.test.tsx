/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InterviewAudioRecorder } from "../interview-audio-recorder";
import {
  saveInterviewAudio,
  flushInterviewAudio,
  recoverInterviewAudio,
} from "../../lib/interview-audio-outbox";

jest.mock("../../lib/interview-audio-outbox", () => ({
  saveInterviewAudio: jest.fn(),
  flushInterviewAudio: jest.fn(),
  recoverInterviewAudio: jest.fn().mockResolvedValue([]),
  appendInterviewAudio: jest.fn().mockResolvedValue(undefined),
}));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const stopTrack = jest.fn();
const track = { enabled: true, stop: stopTrack };
const getUserMedia = jest.fn();
const instances: Recorder[] = [];
class Recorder {
  static isTypeSupported() {
    return true;
  }
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    public stream: MediaStream,
    public options: MediaRecorderOptions,
  ) {
    instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["recorded audio"], { type: "audio/webm" }),
    });
    this.onstop?.();
  }
}
let container: HTMLDivElement;
let root: Root;
let finalizeAudio: (() => Promise<void>) | null = null;
const registerFinalize = (callback: (() => Promise<void>) | null) => {
  finalizeAudio = callback;
};
async function render(
  phase: "reading" | "questions" | "feedback",
  enabled = true,
) {
  await act(async () => {
    root.render(
      <InterviewAudioRecorder
        roundId="round"
        phase={phase}
        enabled={enabled}
        registerFinalize={registerFinalize}
      />,
    );
  });
}
function policy(attemptId: string | null, recordingEnabled: boolean) {
  return {
    ok: true,
    json: async () => ({
      actorId: "actor",
      sessionId: null,
      attemptId,
      captureId: "stable-capture",
      recordingEnabled,
      canSend: false,
      canReceive: false,
    }),
  } as Response;
}
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => "segment-" + instances.length,
  });
  instances.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: Recorder,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  track.enabled = true;
  getUserMedia.mockResolvedValue({ getTracks: () => [track] });
  jest.mocked(saveInterviewAudio).mockResolvedValue(undefined);
  jest
    .mocked(flushInterviewAudio)
    .mockResolvedValue({ pending: 0, error: null });
  global.fetch = jest.fn().mockResolvedValue(policy("attempt-1", true));
  jest.mocked(recoverInterviewAudio).mockResolvedValue([]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.useRealTimers();
});
async function enableMicrophone() {
  await act(async () => {
    container.querySelector("button")?.click();
  });
}

describe("in-person recorder boundaries", () => {
  it("keeps the current encoder during authorization failure and a retry", async () => {
    await render("questions");
    jest.mocked(fetch).mockRejectedValueOnce(new Error("Network unavailable"));
    await render("feedback");
    expect(track.enabled).toBe(false);
    expect(instances[0]?.state).toBe("recording");
    expect(container.textContent).toContain("Network unavailable");
    await enableMicrophone();
    await enableMicrophone();
    expect(track.enabled).toBe(false);
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Retry"))
        ?.click();
    });
    expect(instances).toHaveLength(1);
    expect(track.enabled).toBe(true);
    expect(saveInterviewAudio).not.toHaveBeenCalled();
  });
  it("mutes at the server phase deadline while preserving elapsed silence in the take", async () => {
    jest.useFakeTimers();
    const response = policy("attempt-1", true);
    const body = await response.json();
    jest
      .mocked(fetch)
      .mockResolvedValue({
        ...response,
        json: async () => ({
          ...body,
          expiresAt: new Date(Date.now() + 1_000).toISOString(),
        }),
      } as Response);
    await render("questions");
    // Pin the initial deadline: later failed polls cannot extend authorization.
    jest.mocked(fetch).mockRejectedValue(new Error("Offline"));
    await act(async () => {
      jest.advanceTimersByTime(1_001);
    });
    expect(track.enabled).toBe(false);
    expect(instances[0]?.state).toBe("recording");
    expect(instances).toHaveLength(1);
  });
  it("recovers an interrupted take without concatenating incompatible encoder streams", async () => {
    jest
      .mocked(recoverInterviewAudio)
      .mockResolvedValueOnce(["stable-capture"]);
    await render("questions");
    expect(instances).toHaveLength(0);
    expect(container.textContent).toContain("partial recording was recovered");
  });
  it("finalizes muted audio and waits for persistence and upload before allowing exit", async () => {
    let saved!: () => void;
    jest.mocked(saveInterviewAudio).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          saved = resolve;
        }),
    );
    await render("questions");
    await enableMicrophone();
    await enableMicrophone(); // Muting leaves the server-authorized recorder running.
    expect(instances[0]?.state).toBe("recording");
    let finished = false;
    let finishing!: Promise<void>;
    await act(async () => {
      finishing = finalizeAudio!().then(() => {
        finished = true;
      });
    });
    expect(instances[0]?.state).toBe("inactive");
    expect(saveInterviewAudio).toHaveBeenCalledTimes(1);
    expect(finished).toBe(false);
    await act(async () => {
      saved();
      await finishing;
    });
    expect(finished).toBe(true);
    expect(instances).toHaveLength(1);
  });

  it("refuses exit while the finalized audio still needs uploading", async () => {
    await render("questions");
    await enableMicrophone();
    jest
      .mocked(flushInterviewAudio)
      .mockResolvedValue({ pending: 1, error: "Upload failed" });
    await act(async () => {
      await expect(finalizeAudio!()).rejects.toThrow("Upload failed");
    });
    expect(instances[0]?.state).toBe("inactive");
    jest
      .mocked(flushInterviewAudio)
      .mockResolvedValue({ pending: 0, error: null });
    expect(container.textContent).toContain("Enable microphone");
    await act(async () => {
      await finalizeAudio!();
    });
  });

  it("prepares the microphone automatically and records only server-enabled answer phases", async () => {
    jest.mocked(fetch).mockResolvedValue(policy("attempt-1", false));
    await render("reading");
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(instances).toHaveLength(0);
    expect(container.textContent).toContain(
      "Recording starts during question time",
    );
    jest.mocked(fetch).mockResolvedValue(policy("attempt-1", true));
    await render("questions");
    expect(instances).toHaveLength(1);
    expect(instances[0]?.options.audioBitsPerSecond).toBe(64_000);
    expect(instances[0]?.state).toBe("recording");
    expect(
      container.querySelector("[aria-label='Recording waveform']"),
    ).toBeTruthy();
    await enableMicrophone();
    expect(track.enabled).toBe(false);
    expect(instances[0]?.state).toBe("recording");
    expect(stopTrack).not.toHaveBeenCalled();
  });
  it("keeps the same take running silently during pause and resumes its microphone", async () => {
    await render("questions");
    await enableMicrophone();
    await render("questions", false);
    expect(stopTrack).not.toHaveBeenCalled();
    expect(track.enabled).toBe(false);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.state).toBe("recording");
    await enableMicrophone();
    await render("questions", true);
    expect(track.enabled).toBe(true);
  });
  it("keeps a single encoder and canonical take beyond thirty seconds and into verbal feedback", async () => {
    jest.useFakeTimers();
    await render("questions");
    await enableMicrophone();
    await act(async () => {
      jest.advanceTimersByTime(30_001);
    });
    expect(instances).toHaveLength(1);
    await render("feedback");
    expect(instances).toHaveLength(1);
    expect(instances[0]?.state).toBe("recording");
    await act(async () => {
      await finalizeAudio!();
    });
    expect(saveInterviewAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: "attempt-1",
        captureId: "stable-capture",
        id: "stable-capture",
        complete: true,
      }),
    );
  });
  it("retains the capture attribution anchor when a student's identity is corrected", async () => {
    jest.useFakeTimers();
    await render("questions");
    await enableMicrophone();
    jest.mocked(fetch).mockResolvedValue(policy("corrected-attempt", true));
    await act(async () => {
      jest.advanceTimersByTime(10_001);
    });
    expect(instances).toHaveLength(1);
    await act(async () => {
      await finalizeAudio!();
    });
    expect(saveInterviewAudio).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attemptId: "attempt-1",
        captureId: "stable-capture",
      }),
    );
  });
});
