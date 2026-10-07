import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthProvider, useAuth } from "../auth-provider";

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: jest.fn(),
}));
jest.mock("@sentry/nextjs", () => ({ setUser: jest.fn() }));

function Probe() {
  const { signOut } = useAuth();
  return <button onClick={() => void signOut()}>Log out</button>;
}

it("UCAT logout ends only this session, preserving connected OAuth clients", async () => {
  const signOut = jest.fn().mockResolvedValue({ error: null });
  jest.mocked(getSupabaseBrowserClient).mockReturnValue({
    auth: {
      signOut,
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest
        .fn()
        .mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } },
        }),
    },
  } as unknown as ReturnType<typeof getSupabaseBrowserClient>);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: "local" }));
});
