/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InterviewMedia } from "../interview-media";
import type { InterviewMediaTicket } from "@altitutor/shared";

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
const mockCall = {
  on: jest.fn(),
  participants: () => ({}),
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
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  jest.clearAllMocks();
  mockCreate.mockReturnValue(mockCall);
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
});

describe("interview media lifecycle", () => {
  it("uses the server privacy policy, starts muted before consented device activation, and destroys the call when disabled", async () => {
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
        startAudioOff: true,
        startVideoOff: true,
      }),
    );
    expect(mockStartCamera).not.toHaveBeenCalled();
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
