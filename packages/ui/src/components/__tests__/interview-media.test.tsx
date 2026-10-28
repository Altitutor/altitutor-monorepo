/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InterviewMedia } from "../interview-media";
import type { InterviewMediaTicket } from "@altitutor/shared";
import type { DailyParticipant } from "@daily-co/daily-js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
async function render(element: React.ReactNode) {
  await act(async () => {
    root.render(element);
  });
}
async function waitFor(assertion: () => void) {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
  assertion();
}
const mockJoin = jest.fn();
const mockDestroy = jest.fn();
const mockAudio = jest.fn();
const mockVideo = jest.fn();
const mockSubscribe = jest.fn();
const mockStartCamera = jest.fn();
const mockCreate = jest.fn();
const mockEnumerateDevices = jest.fn();
const mockSetInputDevices = jest.fn();
const mockUpdateInputSettings = jest.fn();
const mockListeners = new Map<string, (event: unknown) => void>();
const mockParticipants = jest.fn<Record<string, DailyParticipant>, []>(
  () => ({}),
);
const meterGlobals = [
  "AudioContext",
  "MediaStream",
  "requestAnimationFrame",
  "cancelAnimationFrame",
] as const;
const originalMeterGlobals = meterGlobals.map((name) =>
  Object.getOwnPropertyDescriptor(globalThis, name),
);
const mockCall = {
  on: jest.fn(),
  off: jest.fn(),
  participants: mockParticipants,
  join: mockJoin,
  destroy: mockDestroy,
  setLocalAudio: mockAudio,
  setLocalVideo: mockVideo,
  setSubscribeToTracksAutomatically: mockSubscribe,
  startCamera: mockStartCamera,
  enumerateDevices: mockEnumerateDevices,
  setInputDevicesAsync: mockSetInputDevices,
  updateInputSettings: mockUpdateInputSettings,
};
jest.mock("@daily-co/daily-js", () => ({
  __esModule: true,
  default: { createCallObject: (...args: unknown[]) => mockCreate(...args) },
}));

const ticket: InterviewMediaTicket = {
  sessionId: "private-reading-pair",
  url: "https://example.daily.co/private",
  token: "test-token",
  canSend: true,
  canReceive: false,
  recordingEnabled: false,
  expiresAt: "2099-10-23T10:02:00Z",
};
function response(body: InterviewMediaTicket) {
  return { ok: true, json: async () => body } as Response;
}

beforeEach(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [{ stop: jest.fn() }],
      }),
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  jest.clearAllMocks();
  mockSubscribe.mockReset();
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  jest
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => undefined);
  mockCreate.mockReturnValue(mockCall);
  mockParticipants.mockReturnValue({});
  mockListeners.clear();
  mockCall.on.mockImplementation(
    (event: string, listener: (event: unknown) => void) => {
      mockListeners.set(event, listener);
      return mockCall;
    },
  );
  mockJoin.mockResolvedValue({});
  mockDestroy.mockResolvedValue(undefined);
  mockStartCamera.mockResolvedValue({});
  mockEnumerateDevices.mockResolvedValue({
    devices: [
      {
        deviceId: "built-in-mic",
        kind: "audioinput",
        label: "Built-in microphone",
      },
      { deviceId: "usb-mic", kind: "audioinput", label: "USB microphone" },
      {
        deviceId: "built-in-camera",
        kind: "videoinput",
        label: "Built-in camera",
      },
      { deviceId: "usb-camera", kind: "videoinput", label: "USB camera" },
    ],
  });
  mockSetInputDevices.mockResolvedValue({ camera: {}, mic: {}, speaker: {} });
  mockUpdateInputSettings.mockResolvedValue({ inputSettings: {} });
  global.fetch = jest.fn().mockResolvedValue(response(ticket));
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  jest.restoreAllMocks();
  jest.useRealTimers();
  meterGlobals.forEach((name, index) => {
    const original = originalMeterGlobals[index];
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  });
});

function meterFixture() {
  mockParticipants.mockReturnValue({
    local: {
      local: true,
      session_id: "local",
      tracks: {
        audio: {
          state: "off",
          persistentTrack: { readyState: "live", stop: jest.fn() },
        },
        video: { state: "off" },
      },
    } as unknown as DailyParticipant,
  });
  const context = {
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    createMediaStreamSource: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    createAnalyser: jest.fn(() => ({
      fftSize: 0,
      getByteTimeDomainData: jest.fn(),
    })),
  };
  const frame = jest.fn().mockReturnValue(1);
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: jest.fn(() => context),
  });
  Object.defineProperty(globalThis, "MediaStream", {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: frame,
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    configurable: true,
    value: jest.fn(),
  });
  return { context, frame };
}

it("keeps interview controls usable if the decorative microphone meter cannot initialize", async () => {
  meterFixture();
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: jest.fn(() => {
      throw new Error("Audio context unavailable");
    }),
  });
  await render(
    <InterviewMedia
      roundId="round"
      phase="reading"
      delivery="online"
      enabled
    />,
  );
  expect(container.querySelector('[aria-label="Mute"]')).not.toBeNull();
});

it("does not start a microphone animation after its context is disposed", async () => {
  const { context, frame } = meterFixture();
  let resumed!: () => void;
  context.resume.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resumed = resolve;
      }),
  );
  await render(
    <InterviewMedia
      roundId="round"
      phase="reading"
      delivery="online"
      enabled
    />,
  );
  expect(context.resume).toHaveBeenCalledTimes(1);
  await render(
    <InterviewMedia
      roundId="round"
      phase="reading"
      delivery="online"
      enabled={false}
    />,
  );
  await act(async () => resumed());
  expect(frame).not.toHaveBeenCalled();
  expect(context.close).toHaveBeenCalled();
});

it("contains microphone-meter resume and cleanup failures", async () => {
  const { context, frame } = meterFixture();
  context.resume.mockRejectedValue(new Error("Gesture required"));
  context.close.mockRejectedValue(new Error("Context already closed"));
  await render(
    <InterviewMedia
      roundId="round"
      phase="reading"
      delivery="online"
      enabled
    />,
  );
  expect(container.querySelector('[aria-label="Mute"]')).not.toBeNull();
  await render(
    <InterviewMedia
      roundId="round"
      phase="reading"
      delivery="online"
      enabled={false}
    />,
  );
  expect(frame).not.toHaveBeenCalled();
});

describe("interview media lifecycle", () => {
  async function openSettings() {
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Camera and microphone settings"]',
        )
        ?.click(),
    );
  }

  async function chooseInput(label: "Microphone" | "Camera", value: string) {
    const input = document.querySelector<HTMLSelectElement>(
      `[aria-label="${label}"]`,
    );
    expect(input).not.toBeNull();
    await act(async () => {
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  it("unblocks input selection after a station change even when an old switch never resolves", async () => {
    let finishOld!: () => void;
    mockSetInputDevices.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishOld = resolve)),
    );
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    await openSettings();
    await chooseInput("Microphone", "usb-mic");
    expect(
      document.querySelector<HTMLSelectElement>('[aria-label="Microphone"]')
        ?.disabled,
    ).toBe(true);
    let finishNew!: () => void;
    const replacementSwitch = jest.fn(
      () => new Promise<void>((resolve) => (finishNew = resolve)),
    );
    mockCreate.mockReturnValueOnce({
      ...mockCall,
      setInputDevicesAsync: replacementSwitch,
    });
    await render(
      <InterviewMedia
        roundId="round"
        phase="reading"
        delivery="online"
        enabled
      />,
    );
    expect(
      document.querySelector<HTMLSelectElement>('[aria-label="Microphone"]')
        ?.disabled,
    ).toBe(false);
    await chooseInput("Microphone", "built-in-mic");
    expect(replacementSwitch).toHaveBeenCalledWith({
      audioDeviceId: "built-in-mic",
    });
    await act(async () => finishOld());
    expect(
      document.querySelector<HTMLSelectElement>('[aria-label="Microphone"]')
        ?.disabled,
    ).toBe(true);
    await act(async () => finishNew());
    expect(
      document.querySelector<HTMLSelectElement>('[aria-label="Microphone"]')
        ?.value,
    ).toBe("built-in-mic");
  });

  it("preserves camera-off and receiving-only policy during device switches", async () => {
    jest.useFakeTimers();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    jest.mocked(fetch).mockResolvedValue(response({ ...ticket, expiresAt }));
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Turn camera off"]')
        ?.click(),
    );
    await openSettings();
    await chooseInput("Camera", "usb-camera");
    expect(mockVideo).toHaveBeenLastCalledWith(false);
    jest
      .mocked(fetch)
      .mockResolvedValue(
        response({ ...ticket, expiresAt, canSend: false, canReceive: true }),
      );
    await act(async () => jest.advanceTimersByTime(10_000));
    await chooseInput("Microphone", "usb-mic");
    expect(mockAudio).toHaveBeenLastCalledWith(false);
    expect(mockVideo).toHaveBeenLastCalledWith(false);
    expect(mockJoin).toHaveBeenCalledTimes(1);
  });

  it("uses the latest mute choice when a device switch completes", async () => {
    let finish!: () => void;
    mockSetInputDevices.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    await openSettings();
    await chooseInput("Microphone", "usb-mic");
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Mute"]')
        ?.click(),
    );
    await act(async () => finish());
    expect(mockAudio).toHaveBeenLastCalledWith(false);
  });

  it("retains selected inputs across call recreation and can return to automatic defaults", async () => {
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    await openSettings();
    await chooseInput("Camera", "usb-camera");
    await render(
      <InterviewMedia
        roundId="round"
        phase="reading"
        delivery="online"
        enabled
      />,
    );
    expect(mockCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        inputSettings: { video: { settings: { deviceId: "usb-camera" } } },
      }),
    );
    await chooseInput("Camera", "");
    expect(mockUpdateInputSettings).toHaveBeenCalledWith({
      video: { settings: {} },
    });
    expect(mockJoin).toHaveBeenCalledTimes(2);
  });

  it("shows unavailable inputs and keeps the call alive when switching fails", async () => {
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    await openSettings();
    await chooseInput("Camera", "usb-camera");
    await act(async () =>
      mockListeners.get("available-devices-updated")?.({
        availableDevices: [],
      }),
    );
    expect(document.body.textContent).toContain("Unavailable camera");
    expect(document.body.textContent).toContain("no longer available");
    mockUpdateInputSettings.mockRejectedValueOnce(new Error("Device denied"));
    await chooseInput("Camera", "");
    expect(document.body.textContent).toContain("Unable to switch input");
    expect(
      document.querySelector<HTMLSelectElement>('[aria-label="Camera"]')?.value,
    ).toBe("usb-camera");
    expect(mockJoin).toHaveBeenCalledTimes(1);
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it("handles device enumeration permissions failures without disrupting the call", async () => {
    mockEnumerateDevices.mockRejectedValueOnce(new Error("Permission denied"));
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    await openSettings();
    expect(document.body.textContent).toContain("Unable to list inputs");
    expect(
      document.querySelector<HTMLSelectElement>('[aria-label="Camera"]')
        ?.disabled,
    ).toBe(false);
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it("switches microphone without unmuting or rejoining", async () => {
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    expect(mockEnumerateDevices).not.toHaveBeenCalled();
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Mute"]')
        ?.click(),
    );
    const settings = container.querySelector<HTMLButtonElement>(
      '[aria-label="Camera and microphone settings"]',
    );
    expect(settings).not.toBeNull();
    await act(async () => settings?.click());
    const microphone = document.querySelector<HTMLSelectElement>(
      '[aria-label="Microphone"]',
    );
    expect(microphone).not.toBeNull();
    expect(microphone?.value).toBe("");
    await act(async () => {
      if (microphone) {
        microphone.value = "usb-mic";
        microphone.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(mockSetInputDevices).toHaveBeenCalledWith({
      audioDeviceId: "usb-mic",
    });
    expect(mockAudio).toHaveBeenLastCalledWith(false);
    expect(mockJoin).toHaveBeenCalledTimes(1);
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it.each([
    ["connection-error", "connection-error"],
    ["private provider value", "unclassified"],
  ])(
    "reports only an approved SDK category and coarse state (%s)",
    async (category, expected) => {
      jest.replaceProperty(process, "env", {
        ...process.env,
        NODE_ENV: "development",
      });
      const warn = jest
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      await render(
        <InterviewMedia
          roundId="round"
          phase="feedback"
          delivery="online"
          enabled
        />,
      );
      await act(async () => {
        mockListeners.get("error")?.({
          errorMsg: "private raw provider message",
          error: {
            type: category,
            details: { uri: "private provider URL" },
          },
        });
      });
      expect(warn).toHaveBeenCalledWith(
        "[Interview media] Local call failure",
        {
          category: expected,
          state: "joined",
        },
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain("private");
      expect(container.textContent).toContain("The call was interrupted");
    },
  );

  it("does not emit temporary call diagnostics outside local development", async () => {
    jest.replaceProperty(process, "env", {
      ...process.env,
      NODE_ENV: "production",
    });
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    await act(async () =>
      mockListeners.get("error")?.({ error: { type: "connection-error" } }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("defaults to movable PIP and changes view without reconnecting the call", async () => {
    mockParticipants.mockReturnValue({
      local: {
        local: true,
        session_id: "local",
        tracks: { video: { state: "off" }, audio: { state: "off" } },
      } as unknown as DailyParticipant,
      remote: {
        local: false,
        session_id: "remote",
        user_name: "Student",
        tracks: { video: { state: "off" }, audio: { state: "off" } },
      } as unknown as DailyParticipant,
    });
    jest
      .mocked(fetch)
      .mockResolvedValue(response({ ...ticket, canReceive: true }));
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    const preview = container.querySelector<HTMLButtonElement>(
      '[aria-label="Move your video preview (bottom right)"]',
    );
    expect(preview).not.toBeNull();
    await act(async () => {
      preview?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
      );
      preview?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
    });
    expect(
      container.querySelector(
        '[aria-label="Move your video preview (top left)"]',
      ),
    ).not.toBeNull();
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Switch to side by side"]',
        )
        ?.click();
    });
    expect(
      container.querySelector('[aria-label^="Move your video preview"]'),
    ).toBeNull();
    expect(container.querySelectorAll("video")).toHaveLength(2);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Switch to picture in picture"]',
        )
        ?.click();
    });
    expect(
      container.querySelector(
        '[aria-label="Move your video preview (top left)"]',
      ),
    ).not.toBeNull();
    expect(mockJoin).toHaveBeenCalledTimes(1);
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it("does not show a connection warning for a healthy Daily network event", async () => {
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    await act(async () => {
      mockListeners.get("joined-meeting")?.({ action: "joined-meeting" });
      mockListeners.get("network-connection")?.({
        action: "network-connection",
        type: "sfu",
        event: "connected",
      });
    });
    expect(container.textContent).not.toContain("Checking call connection");
    expect(container.textContent).not.toContain("Reconnecting");
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it("waits for every interrupted connection to recover without restarting the call", async () => {
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    const network = mockListeners.get("network-connection");
    expect(network).toBeDefined();
    await act(async () => {
      network?.({ type: "signaling", event: "interrupted" });
      network?.({ type: "sfu", event: "interrupted" });
      network?.({ type: "signaling", event: "connected" });
    });
    expect(container.textContent).toContain("Reconnecting to your station");
    await act(async () => network?.({ type: "sfu", event: "connected" }));
    expect(container.textContent).not.toContain("Reconnecting");
    expect(mockJoin).toHaveBeenCalledTimes(1);
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it("joins before subscribing so a feedback call can receive remote video and audio", async () => {
    let joined = false;
    let finishJoin!: () => void;
    // Daily 0.94 rejects this method until join() resolves, including during joining.
    mockSubscribe.mockImplementation(() => {
      if (!joined)
        throw new Error(
          "setSubscribeToTracksAutomatically() only supported after join. Use the subscribeToTracksAutomatically configuration property.",
        );
    });
    mockJoin.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishJoin = () => {
            joined = true;
            resolve();
          };
        }),
    );
    const remoteVideo = { kind: "video" } as MediaStreamTrack;
    const remoteAudio = { kind: "audio" } as MediaStreamTrack;
    mockParticipants.mockReturnValue({
      remote: {
        local: false,
        session_id: "remote",
        user_name: "Student",
        tracks: {
          video: { state: "playable", persistentTrack: remoteVideo },
          audio: { state: "playable", persistentTrack: remoteAudio },
        },
      } as unknown as DailyParticipant,
    });
    Object.defineProperty(globalThis, "MediaStream", {
      configurable: true,
      value: class {
        constructor(private tracks: MediaStreamTrack[]) {}
        getTracks() {
          return this.tracks;
        }
      },
    });
    jest
      .mocked(fetch)
      .mockResolvedValue(response({ ...ticket, canReceive: true }));
    try {
      await render(
        <InterviewMedia
          roundId="round"
          phase="feedback"
          delivery="online"
          enabled
        />,
      );
      expect(container.textContent).not.toContain("only supported after join");
      expect(mockJoin).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ subscribeToTracksAutomatically: false }),
      );
      await act(async () => finishJoin());
      expect(mockSubscribe).toHaveBeenCalledWith(true);
      const video = container.querySelector<HTMLVideoElement>(
        '[aria-label="Student video"]',
      );
      const audio = container.querySelector("audio");
      expect((video?.srcObject as MediaStream)?.getTracks()).toEqual([
        remoteVideo,
      ]);
      expect((audio?.srcObject as MediaStream)?.getTracks()).toEqual([
        remoteAudio,
      ]);
    } finally {
      await render(null);
    }
  });

  it("keeps remote participants hidden until receiving is permitted, without rejoining", async () => {
    jest.useFakeTimers();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    jest.mocked(fetch).mockResolvedValue(response({ ...ticket, expiresAt }));
    mockParticipants.mockReturnValue({
      remote: {
        local: false,
        session_id: "remote",
        user_name: "Tutor",
        tracks: { video: { state: "off" }, audio: { state: "off" } },
      } as unknown as DailyParticipant,
    });
    await render(
      <InterviewMedia
        roundId="round"
        phase="reading"
        delivery="online"
        enabled
      />,
    );
    await waitFor(() => expect(mockSubscribe).toHaveBeenLastCalledWith(false));
    expect(container.querySelector('[aria-label="Tutor video"]')).toBeNull();
    jest.mocked(fetch).mockResolvedValue(
      response({
        ...ticket,
        expiresAt,
        url: undefined,
        token: undefined,
        canReceive: true,
        canSend: false,
      }),
    );
    await act(async () => jest.advanceTimersByTime(10_000));
    expect(mockJoin).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenLastCalledWith(true);
    expect(mockAudio).toHaveBeenLastCalledWith(false);
    expect(mockVideo).toHaveBeenLastCalledWith(false);
    expect(
      container.querySelector('[aria-label="Tutor video"]'),
    ).not.toBeNull();
  });

  it("does not resume media if a join completes after its lease expired", async () => {
    jest.useFakeTimers();
    let finishJoin!: () => void;
    mockJoin.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishJoin = resolve)),
    );
    jest.mocked(fetch).mockResolvedValue(
      response({
        ...ticket,
        canReceive: true,
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      }),
    );
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    expect(mockJoin).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(1001));
    expect(mockDestroy).toHaveBeenCalledTimes(1);
    await act(async () => finishJoin());
    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(mockAudio).not.toHaveBeenCalledWith(true);
    expect(mockVideo).not.toHaveBeenCalledWith(true);
  });

  it("retries a failed join before applying subscriptions", async () => {
    jest.useFakeTimers();
    mockJoin.mockRejectedValueOnce(new Error("Call connection failed"));
    jest
      .mocked(fetch)
      .mockResolvedValue(response({ ...ticket, canReceive: true }));
    await render(
      <InterviewMedia
        roundId="round"
        phase="feedback"
        delivery="online"
        enabled
      />,
    );
    expect(container.textContent).toContain("Call connection failed");
    expect(mockSubscribe).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(10_000));
    expect(mockJoin).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenCalledWith(true);
    expect(container.textContent).not.toContain("Call connection failed");
  });

  it("waits for a waiting-room preview to finish destroying before creating the live call", async () => {
    let destroyed!: () => void;
    await render(
      <InterviewMedia
        key="waiting"
        roundId="round"
        phase="waiting"
        delivery="online"
        enabled
      />,
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    mockDestroy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          destroyed = resolve;
        }),
    );
    try {
      await render(
        <InterviewMedia
          key="live"
          roundId="round"
          phase="reading"
          delivery="online"
          enabled
        />,
      );
      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => destroyed());
    }
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("starts the camera and microphone on when joining, and stops them when disabled", async () => {
    await render(
      <InterviewMedia
        roundId="round"
        phase="reading"
        delivery="online"
        enabled
      />,
    );
    await waitFor(() => expect(mockJoin).toHaveBeenCalledTimes(1));
    expect(mockSubscribe).toHaveBeenCalledWith(false);
    expect(mockJoin).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "test-token",
        startAudioOff: false,
        startVideoOff: false,
      }),
    );
    expect(mockStartCamera).toHaveBeenCalledWith({
      startAudioOff: false,
      startVideoOff: false,
    });
    expect(container.querySelector('[aria-label="Mute"]')).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Turn camera off"]'),
    ).not.toBeNull();
    await render(
      <InterviewMedia
        roundId="round"
        phase="reading"
        delivery="online"
        enabled={false}
      />,
    );
    await waitFor(() => expect(mockDestroy).toHaveBeenCalledTimes(1));
    expect(mockAudio).toHaveBeenLastCalledWith(false);
    expect(mockVideo).toHaveBeenLastCalledWith(false);
    expect(mockJoin).toHaveBeenCalledTimes(1);
  });

  it("never joins an obsolete pair when its request resolves after rotation", async () => {
    let resolveOld: (value: Response) => void = () => undefined;
    jest.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveOld = resolve;
        }),
    );
    jest.mocked(fetch).mockResolvedValue(
      response({
        sessionId: null,
        canSend: false,
        canReceive: false,
        recordingEnabled: false,
      }),
    );
    await render(
      <InterviewMedia
        roundId="round"
        phase="reading"
        delivery="online"
        enabled
      />,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await render(
      <InterviewMedia
        roundId="round"
        phase="waiting"
        delivery="online"
        enabled
      />,
    );
    await act(async () => {
      resolveOld(response(ticket));
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(mockJoin).not.toHaveBeenCalled();
  });

  it("cuts off capture at the server lease deadline even without another poll", async () => {
    jest.useFakeTimers();
    jest.mocked(fetch).mockResolvedValue(
      response({
        ...ticket,
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      }),
    );
    await render(
      <InterviewMedia
        roundId="round"
        phase="questions"
        delivery="online"
        enabled
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockJoin).toHaveBeenCalled());
    await act(async () => {
      jest.advanceTimersByTime(1001);
    });
    expect(mockDestroy).toHaveBeenCalledTimes(1);
    expect(mockAudio).toHaveBeenLastCalledWith(false);
    expect(mockVideo).toHaveBeenLastCalledWith(false);

    jest.useRealTimers();
  });

  it("does not load Daily or fetch online media for in-person interviews", async () => {
    await render(
      <InterviewMedia
        roundId="round"
        phase="questions"
        delivery="in_person"
        enabled
      />,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

it("reports a handled fatal SDK failure through the safe portal boundary", async () => {
  const report = jest.fn();
  await render(
    <InterviewMedia
      roundId="private-round"
      phase="feedback"
      delivery="online"
      enabled
      onCallFailure={report}
    />,
  );
  await act(async () =>
    mockListeners.get("error")?.({
      errorMsg: "secret token-bearing URL",
      error: { type: "connection-error", details: { uri: "secret room URL" } },
    }),
  );
  expect(report).toHaveBeenCalledWith({
    source: "sdk",
    category: "connection",
    phase: "feedback",
    state: "joined",
  });
  expect(JSON.stringify(report.mock.calls)).not.toContain("secret");
});

it("reports sustained join failure, but gives a transient rejection time to recover", async () => {
  jest.useFakeTimers();
  const report = jest.fn();
  mockJoin.mockRejectedValue(new Error("private join response"));
  await render(
    <InterviewMedia
      roundId="round"
      phase="questions"
      delivery="online"
      enabled
      onCallFailure={report}
    />,
  );
  expect(report).not.toHaveBeenCalled();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(20_000);
  });
  expect(report).toHaveBeenCalledWith({
    source: "join",
    category: "unknown",
    phase: "questions",
    state: "joining",
  });
});

it("does not report camera declines or transient SDK interruptions as fatal call failures", async () => {
  const report = jest.fn();
  await render(
    <InterviewMedia
      roundId="round"
      phase="reading"
      delivery="online"
      enabled
      onCallFailure={report}
    />,
  );
  await act(async () => {
    mockListeners.get("network-connection")?.({
      type: "signaling",
      event: "interrupted",
    });
    mockListeners.get("network-connection")?.({
      type: "signaling",
      event: "connected",
    });
    mockListeners.get("camera-error")?.({ errorMsg: "private device label" });
  });
  expect(report).not.toHaveBeenCalled();
});

it("ignores an obsolete SDK fatal event after the active call has closed", async () => {
  const report = jest.fn();
  await render(
    <InterviewMedia
      roundId="round"
      phase="questions"
      delivery="online"
      enabled
      onCallFailure={report}
    />,
  );
  const fatal = mockListeners.get("error");
  await act(async () => fatal?.({ error: { type: "connection-error" } }));
  report.mockClear();
  await act(async () => fatal?.({ error: { type: "connection-error" } }));
  expect(report).not.toHaveBeenCalled();
});

it("does not report a planned provider expiry at the server lease deadline", async () => {
  jest.useFakeTimers();
  const report = jest.fn();
  global.fetch = jest.fn().mockResolvedValue(
    response({
      ...ticket,
      expiresAt: new Date(Date.now() + 500).toISOString(),
    }),
  );
  await render(
    <InterviewMedia
      roundId="round"
      phase="questions"
      delivery="online"
      enabled
      onCallFailure={report}
    />,
  );
  await act(async () =>
    mockListeners.get("error")?.({ error: { type: "exp-token" } }),
  );
  expect(report).not.toHaveBeenCalled();
});

it("keeps recovery working when a reporter throws", async () => {
  const report = jest.fn(() => {
    throw new Error("monitoring unavailable");
  });
  await render(
    <InterviewMedia
      roundId="round"
      phase="questions"
      delivery="online"
      enabled
      onCallFailure={report}
    />,
  );
  await act(async () =>
    mockListeners.get("error")?.({ error: { type: "connection-error" } }),
  );
  expect(container.textContent).toContain("The call was interrupted");
  expect(mockDestroy).toHaveBeenCalled();
});

it("reports sustained media-policy recovery failures without adding a polling loop", async () => {
  jest.useFakeTimers();
  const report = jest.fn();
  global.fetch = jest
    .fn()
    .mockResolvedValue(
      response({
        ...ticket,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );
  await render(
    <InterviewMedia
      roundId="round"
      phase="questions"
      delivery="online"
      enabled
      onCallFailure={report}
    />,
  );
  await waitFor(() =>
    expect(mockSubscribe).toHaveBeenCalledWith(ticket.canReceive),
  );
  global.fetch = jest
    .fn()
    .mockRejectedValue(new TypeError("private network URL"));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(report).toHaveBeenCalledWith({
    source: "recovery",
    category: "unknown",
    phase: "questions",
    state: "joined",
  });
});

it('does not report provider ejection during an intentional station cutoff', async () => {
  const report = jest.fn();
  await render(<InterviewMedia roundId="round" phase="questions" delivery="online" enabled onCallFailure={report} />);
  await act(async () => mockListeners.get('error')?.({ error: { type: 'ejected' } }));
  expect(report).not.toHaveBeenCalled();
});


it.each([400, 403, 429])("reports sustained unexpected media-policy HTTP %s failures", async (status) => {
  jest.useFakeTimers();
  const report = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({ok: false, status, json: async () => ({error: "private response"})});
  await render(<InterviewMedia roundId="round" phase="questions" delivery="online" enabled onCallFailure={report} />);
  await act(async () => { await jest.advanceTimersByTimeAsync(20_000); });
  expect(report).toHaveBeenCalledWith({source: "recovery", category: "unknown", phase: "questions", state: "joining"});
  expect(JSON.stringify(report.mock.calls)).not.toContain("private");
});
