/** @jest-environment jsdom */
import React, { act } from "react";
import { fireEvent } from "@testing-library/dom";
import { createRoot } from "react-dom/client";
import { InterviewRecordingPlayer } from "../interview-recording-player";
import type { InterviewRecording } from "@altitutor/shared";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const recording: InterviewRecording = {
  id: "recording",
  attemptId: "attempt",
  state: "ready",
  kind: "audio",
  createdAt: "2026-11-05T10:00:00Z",
  startedAt: "2026-11-05T10:00:05Z",
  expiresAt: "2099-01-01T00:00:00Z",
};

it("loads inline audio on demand and seeks repeated question segments against the recording clock", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const loadUrl = jest.fn(async () => ({
    url: "https://example.com/recording.webm",
  }));
  await act(async () =>
    root.render(
      <InterviewRecordingPlayer
        recording={recording}
        loadUrl={loadUrl}
        questions={[{ id: "q1" }, { id: "q2" }]}
        intervals={[
          {
            questionId: "q1",
            startedAt: "2026-11-05T10:00:00Z",
            endedAt: "2026-11-05T10:00:20Z",
          },
          {
            questionId: "q2",
            startedAt: "2026-11-05T10:00:20Z",
            endedAt: "2026-11-05T10:00:40Z",
          },
          {
            questionId: "q1",
            startedAt: "2026-11-05T10:00:40Z",
            endedAt: "2026-11-05T10:01:00Z",
          },
        ]}
      />,
    ),
  );
  expect(loadUrl).not.toHaveBeenCalled();
  await act(async () => host.querySelector("button")?.click());
  const audio = host.querySelector("audio")!;
  expect(audio.getAttribute("src")).toBe("https://example.com/recording.webm");
  Object.defineProperty(audio, "duration", { configurable: true, value: 55 });
  await act(async () =>
    audio.dispatchEvent(new Event("loadedmetadata", { bubbles: true })),
  );
  const buttons = Array.from(
    host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Jump to question"]'),
  );
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    "Jump to question 1, segment 1",
    "Jump to question 2, segment 2",
    "Jump to question 1, segment 3",
  ]);
  await act(async () => buttons[2].click());
  expect(audio.currentTime).toBe(35);
  const slider = host.querySelector<HTMLInputElement>(
    'input[aria-label="Recording progress"]',
  )!;
  await act(async () =>
    fireEvent.change(slider, { target: { value: "22.5" } }),
  );
  expect(audio.currentTime).toBe(22.5);
  await act(async () => root.unmount());
  host.remove();
});

it("recovers an unindexed WebM duration before exposing its question scrubber", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <InterviewRecordingPlayer
        recording={recording}
        loadUrl={async () => ({ url: "blob:unindexed-webm" })}
        questions={[{ id: "q1" }]}
        intervals={[
          {
            questionId: "q1",
            startedAt: "2026-11-05T10:00:05Z",
            endedAt: "2026-11-05T10:00:30Z",
          },
        ]}
      />,
    ),
  );
  await act(async () => host.querySelector("button")?.click());
  const audio = host.querySelector("audio")!;
  Object.defineProperty(audio, "duration", {
    configurable: true,
    value: Infinity,
  });
  await act(async () =>
    audio.dispatchEvent(new Event("loadedmetadata", { bubbles: true })),
  );
  expect(audio.currentTime).toBeGreaterThan(1_000_000);
  Object.defineProperty(audio, "duration", {
    configurable: true,
    value: 46.86,
  });
  await act(async () =>
    audio.dispatchEvent(new Event("durationchange", { bubbles: true })),
  );
  expect(audio.currentTime).toBe(0);
  expect(
    host
      .querySelector('input[aria-label="Recording progress"]')
      ?.getAttribute("max"),
  ).toBe("46.86");
  expect(
    host.querySelector('button[aria-label="Jump to question 1, segment 1"]'),
  ).not.toBeNull();
  await act(async () => root.unmount());
  host.remove();
});

it("preserves an explicit user seek while unindexed duration discovery finishes", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <InterviewRecordingPlayer
        recording={recording}
        loadUrl={async () => ({ url: "blob:unindexed-webm" })}
      />,
    ),
  );
  await act(async () => host.querySelector("button")?.click());
  const audio = host.querySelector("audio")!;
  Object.defineProperty(audio, "duration", {
    configurable: true,
    value: Infinity,
  });
  await act(async () =>
    audio.dispatchEvent(new Event("loadedmetadata", { bubbles: true })),
  );
  await act(async () => fireEvent.pointerDown(audio));
  audio.currentTime = 12;
  Object.defineProperty(audio, "duration", {
    configurable: true,
    value: 46.86,
  });
  await act(async () =>
    audio.dispatchEvent(new Event("durationchange", { bubbles: true })),
  );
  expect(audio.currentTime).toBe(12);
  await act(async () => root.unmount());
  host.remove();
});

it.each(["audio", "video"] as const)(
  "offers the shared playback controls and an unsegmented scrubber for tutor %s",
  async (kind) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(
        <InterviewRecordingPlayer
          recording={{ ...recording, kind }}
          loadUrl={async () => ({ url: "https://example.com/recording" })}
        />,
      ));
      await act(async () => host.querySelector("button")?.click());
      const media = host.querySelector<HTMLMediaElement>(kind)!;
      expect(media.controls).toBe(false);
      Object.defineProperty(media, "duration", { value: 80 });
      await act(async () => media.dispatchEvent(new Event("loadedmetadata")));
      const slider = host.querySelector<HTMLInputElement>('input[aria-label="Recording progress"]')!;
      expect(slider.disabled).toBe(false);
      expect(host.querySelector(`button[aria-label="Play ${kind}"]`)).not.toBeNull();
      expect(host.querySelector('button[aria-label="Playback speed"]')).not.toBeNull();
      await act(async () => fireEvent.change(slider, { target: { value: "45" } }));
      expect(media.currentTime).toBe(45);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);
