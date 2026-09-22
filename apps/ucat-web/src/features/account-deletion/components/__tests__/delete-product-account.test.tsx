import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteProductAccount } from "@/features/account-deletion/components/delete-product-account";

const push = jest.fn();
const refresh = jest.fn();
const signOut = jest.fn(async () => ({ error: null }));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut } }),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock("@altitutor/ui", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
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
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
  Label: ({ children, ...props }: React.ComponentProps<"label">) => (
    <label {...props}>{children}</label>
  ),
}));

describe("DeleteProductAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the account only after the consequences and a matching full name", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ loginRemoved: true }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DeleteProductAccount firstName="Ada" lastName="Lovelace" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(
      screen.getByText(
        /cancelled immediately and the current period is not refunded/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const confirmButtons = screen.getAllByRole("button", {
      name: "Delete account",
    });
    const confirm = confirmButtons[confirmButtons.length - 1];
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "ada lovelace" },
    });
    const namedButtons = screen.getAllByRole("button", {
      name: "Delete account",
    });
    fireEvent.click(namedButtons[namedButtons.length - 1]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/ucat/account/deletion",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ fullName: "ada lovelace" }),
        }),
      );
    });
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/login");
    });
  });

  it("keeps a tutoring student signed in and returns them to signup", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ loginRemoved: false }),
    })) as unknown as typeof fetch;

    render(<DeleteProductAccount firstName="Ada" lastName="Lovelace" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Ada Lovelace" },
    });
    const namedButtons = screen.getAllByRole("button", {
      name: "Delete account",
    });
    fireEvent.click(namedButtons[namedButtons.length - 1]);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/signup/complete");
    });
    expect(signOut).not.toHaveBeenCalled();
  });
});
