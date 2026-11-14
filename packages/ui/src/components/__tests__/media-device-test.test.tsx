/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MediaDeviceTest } from "../media-device-test";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getUserMedia = jest.fn();
const stopTrack = jest.fn();
const track = { enabled: true, stop: stopTrack, getSettings: () => ({}), addEventListener: jest.fn() };
const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
const createUrl = jest.fn();
const revokeUrl = jest.fn();
let container: HTMLDivElement;
let root: Root;
const recorders: TestRecorder[] = [];

class TestRecorder {
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { recorders.push(this); }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["test audio"]) });
    this.onstop?.();
  }
}

async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button?.click());
}

beforeEach(async () => {
  jest.clearAllMocks();
  recorders.length = 0;
  createUrl.mockImplementationOnce(() => "blob:first").mockImplementation(() => "blob:second");
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
    getUserMedia,
    enumerateDevices: jest.fn().mockResolvedValue([]),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  } });
  Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: TestRecorder });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeUrl });
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  getUserMedia.mockResolvedValue(stream);
  track.enabled = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<MediaDeviceTest />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("records locally, mutes during replay, and releases replaced and discarded clips", async () => {
  expect(getUserMedia).not.toHaveBeenCalled();
  await click("Enable microphone");
  await click("Record test clip");
  await click("Stop recording");
  expect(container.querySelector("audio")?.getAttribute("src")).toBe("blob:first");
  await click("Play clip");
  expect(track.enabled).toBe(false);
  await click("Stop playback");
  expect(track.enabled).toBe(true);
  await click("Record again");
  expect(revokeUrl).toHaveBeenCalledWith("blob:first");
  await click("Stop recording");
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Delete test clip"]')?.click());
  expect(revokeUrl).toHaveBeenCalledWith("blob:second");
  expect(container.querySelector("audio")).toBeNull();
});

it("stops a device grant that arrives after leaving the test", async () => {
  let grant: ((value: MediaStream) => void) | undefined;
  getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
  await click("Test camera");
  await act(async () => root.render(null));
  await act(async () => grant?.(stream));
  expect(stopTrack).toHaveBeenCalledTimes(1);
});

it("bounds test recordings and releases the clip and input when leaving", async () => {
  jest.useFakeTimers();
  await click("Enable microphone");
  await click("Record test clip");
  await act(async () => jest.advanceTimersByTime(30_000));
  expect(recorders.at(-1)?.state).toBe("inactive");
  expect(container.textContent).toContain("Your test clip");
  await act(async () => root.render(null));
  expect(revokeUrl).toHaveBeenCalledWith("blob:first");
  expect(stopTrack).toHaveBeenCalledTimes(1);
});
