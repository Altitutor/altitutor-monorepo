import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConnectedSignInMethods } from "@/features/settings/components/connected-sign-in-methods";

const getUserIdentities = jest.fn();
const linkIdentity = jest.fn();
const unlinkIdentity = jest.fn();
const toast = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { getUserIdentities, linkIdentity, unlinkIdentity },
  }),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock("@/features/settings/components/settings-row", () => ({
  SettingsRow: ({
    title,
    description,
    control,
  }: {
    title: string;
    description: string;
    control: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {control}
    </section>
  ),
}));

jest.mock("@altitutor/ui", () => ({
  useToast: () => ({ toast }),
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  AlertDialogAction: ({
    children,
    ...props
  }: React.ComponentProps<"button">) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({
    children,
    ...props
  }: React.ComponentProps<"button">) => <button {...props}>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h3>{children}</h3>
  ),
}));

const emailIdentity = {
  id: "email-identity",
  provider: "email",
  identity_data: { email: "student@example.com" },
};
const googleIdentity = {
  id: "google-identity",
  provider: "google",
  identity_data: { email: "student@gmail.com" },
};

describe("ConnectedSignInMethods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserIdentities.mockResolvedValue({
      data: { identities: [emailIdentity] },
      error: null,
    });
    linkIdentity.mockResolvedValue({ error: null });
    unlinkIdentity.mockResolvedValue({ error: null });
  });

  it("starts authenticated manual linking with the settings callback", async () => {
    render(<ConnectedSignInMethods enabledProviders={["google"]} />);
    const connect = await screen.findByRole("button", { name: "Connect" });

    fireEvent.click(connect);

    await waitFor(() => expect(linkIdentity).toHaveBeenCalledTimes(1));
    const request = linkIdentity.mock.calls[0][0];
    expect(request.provider).toBe("google");
    const callback = new URL(request.options.redirectTo);
    expect(Object.fromEntries(callback.searchParams)).toEqual({
      intent: "link",
      provider: "google",
      next: "/settings/profile",
    });
  });

  it("uses Supabase's supported unlink call when another identity exists", async () => {
    getUserIdentities.mockResolvedValue({
      data: { identities: [emailIdentity, googleIdentity] },
      error: null,
    });
    render(<ConnectedSignInMethods enabledProviders={["google"]} />);
    const remove = await screen.findByRole("button", { name: "Remove" });

    fireEvent.click(remove);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove sign-in method" }),
    );

    await waitFor(() =>
      expect(unlinkIdentity).toHaveBeenCalledWith(googleIdentity),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Google removed" }),
    );
  });

  it("disables unlinking when Supabase reports only one identity", async () => {
    getUserIdentities.mockResolvedValue({
      data: { identities: [googleIdentity] },
      error: null,
    });
    render(<ConnectedSignInMethods enabledProviders={["google"]} />);

    expect(
      await screen.findByRole("button", { name: "Remove" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/cannot remove your only sign-in method/i),
    ).toBeInTheDocument();
  });
});
