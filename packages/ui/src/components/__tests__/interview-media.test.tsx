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
  participants: mockParticipants,
  join: mockJoin,
  destroy: mockDestroy,
  setLocalAudio: mockAudio,
  setLocalVideo: mockVideo,
  setSubscribeToTracksAutomatically: mockSubscribe,
  startCamera: mockStartCamera,
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
  mockCreate.mockReturnValue(mockCall);
  mockParticipants.mockReturnValue({});
  mockCall.on.mockReturnValue(mockCall);
  mockJoin.mockResolvedValue({});
  mockDestroy.mockResolvedValue(undefined);
  mockStartCamera.mockResolvedValue({});
  global.fetch = jest.fn().mockResolvedValue(response(ticket));
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
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
