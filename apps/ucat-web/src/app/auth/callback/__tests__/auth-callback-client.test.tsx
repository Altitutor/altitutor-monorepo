/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { AuthCallbackClient } from "@/app/auth/callback/auth-callback-client";
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";

let searchParams = new URLSearchParams(
  "code=pkce-code&intent=login&provider=apple&next=%2Fdashboard",
);

const exchangeCodeForSession = jest.fn();
const getSession = jest.fn();
const updateUser = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

jest.mock("@/features/auth/lib/navigate-after-auth", () => ({
  navigateAfterAuth: jest.fn(),
}));

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      exchangeCodeForSession,
      getSession,
      updateUser,
      verifyOtp: jest.fn(),
    },
  }),
}));

jest.mock("@/lib/analytics/posthog", () => ({
  captureUcatEvent: jest.fn(),
}));

describe("AuthCallbackClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exchangeCodeForSession.mockReset();
    getSession.mockReset();
    updateUser.mockReset();
    searchParams = new URLSearchParams(
      "code=pkce-code&intent=login&provider=apple&next=%2Fdashboard",
    );

    let resolveExchange!: (value: {
      data?: unknown;
      error: { message: string } | null;
    }) => void;
    exchangeCodeForSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExchange = resolve;
        }),
    );
    (
      exchangeCodeForSession as unknown as {
        flush: (value: {
          data?: unknown;
          error: { message: string } | null;
        }) => void;
      }
    ).flush = (value) => resolveExchange(value);

    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    updateUser.mockResolvedValue({ error: null });
  });

  it("exchanges the PKCE code and hard-navigates at most once when searchParams identity churns", async () => {
    const { rerender } = render(<AuthCallbackClient />);

    await act(async () => {
      searchParams = new URLSearchParams(searchParams.toString());
      rerender(<AuthCallbackClient />);
      searchParams = new URLSearchParams(searchParams.toString());
      rerender(<AuthCallbackClient />);
    });

    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      (
        exchangeCodeForSession as unknown as {
          flush: (value: { error: null }) => void;
        }
      ).flush({ error: null });
    });

    await waitFor(() => {
      expect(navigateAfterAuth).toHaveBeenCalledTimes(1);
    });

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(navigateAfterAuth).toHaveBeenCalledWith(
      "/auth/continue?intent=login&provider=apple&next=%2Fdashboard",
    );
  });
});
