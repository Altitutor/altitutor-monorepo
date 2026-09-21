import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InvitationCodeEntry } from "../invitation-code-entry";
import { pendingInvitation } from "../../lib/pending-invitation";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/lib/analytics/posthog", () => ({ captureUcatEvent: jest.fn() }));
jest.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
}));
const offer = {
  code: "WELCOME",
  kind: "access_pass",
  name: "Founder gift",
  description: "2 free weeks",
  terms: "Payment card required. Renews automatically.",
};
beforeEach(() => {
  sessionStorage.clear();
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => offer });
});
it.each(["access_pass", "discount", "referral"])(
  "Check code applies a %s offer without a separate redeem action",
  async (kind) => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...offer, kind }),
    });
    const apply = jest.fn().mockResolvedValue(undefined);
    render(
      <InvitationCodeEntry
        initialCode={offer.code}
        appearance="plain"
        onCodeApplied={apply}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Check code" }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(offer.code));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/ucat/invitations?code=WELCOME");
    expect(
      screen.queryByRole("button", { name: "Start free access" }),
    ).not.toBeInTheDocument();
    expect(pendingInvitation()).toBe(offer.code);
  },
);
it("keeps gift acceptance explicit after the sampler without granting access", async () => {
  const apply = jest.fn();
  render(
    <InvitationCodeEntry
      initialCode={offer.code}
      presentation="gift"
      onCodeApplied={apply}
    />,
  );
  await screen.findByRole("button", { name: "Accept gift" });
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Accept gift" }));
  await waitFor(() => expect(apply).toHaveBeenCalledWith(offer.code));
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("Continue with Free does not apply or redeem the invitation", async () => {
  const declined = jest.fn();
  const apply = jest.fn();
  render(
    <InvitationCodeEntry
      initialCode={offer.code}
      presentation="gift"
      onDeclined={declined}
      onCodeApplied={apply}
    />,
  );
  await screen.findByRole("button", { name: "Accept gift" });
  fireEvent.click(screen.getByRole("button", { name: "Continue with Free" }));
  expect(declined).toHaveBeenCalledTimes(1);
  expect(apply).not.toHaveBeenCalled();
  expect(pendingInvitation()).toBeNull();
});
it("reports an invalid code without changing checkout", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: false,
    json: async () => ({ error: "Code expired" }),
  });
  const apply = jest.fn();
  render(
    <InvitationCodeEntry initialCode={offer.code} onCodeApplied={apply} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Check code" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Code expired");
  expect(apply).not.toHaveBeenCalled();
});
