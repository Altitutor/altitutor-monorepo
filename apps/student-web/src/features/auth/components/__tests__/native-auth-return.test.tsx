import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NativeAuthReturn } from "../native-auth-return";

Object.assign(globalThis, { React });

jest.mock("@altitutor/ui", () => {
  const ReactRuntime = require("react") as typeof import("react");
  return {
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => ReactRuntime.createElement("button", { type: "button", disabled, onClick }, children),
  };
});

const props = {
  callback: "altitutor-student://auth-return",
  state: "state",
  challenge: "challenge",
  email: "test@example.com",
};

describe("native auth return", () => {
  const originalLocation = window.location;
  beforeAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign: jest.fn() },
    });
  });
  afterAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
  beforeEach(() => {
    jest.mocked(window.location.assign).mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ticket: "single-use-ticket" }),
    });
  });

  it("automatically prepares the return once under StrictMode, retaining a fallback", async () => {
    render(
      <React.StrictMode>
        <NativeAuthReturn {...props} />
      </React.StrictMode>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const link = await screen.findByRole("link", { name: "Open the app again" });
    expect(link).toHaveAttribute(
      "href",
      "altitutor-student://auth-return#ticket=single-use-ticket&state=state",
    );
    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(link.getAttribute("href"));
    fireEvent.click(link);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shows a retry if issuing the ticket fails", async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new Error("Temporarily unavailable"));
    render(<NativeAuthReturn {...props} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("link", { name: "Open the app again" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
