import { pendingInvitation, rememberInvitation } from "../pending-invitation";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => jest.restoreAllMocks());
it("retains an invitation after tab-session storage is cleared", () => {
  rememberInvitation("WELCOME");
  sessionStorage.clear();
  expect(pendingInvitation()).toBe("WELCOME");
});
it("expires remembered invitations after 30 days", () => {
  const now = Date.now();
  rememberInvitation("WELCOME");
  jest.spyOn(Date, "now").mockReturnValue(now + 31 * 86400000);
  expect(pendingInvitation()).toBeNull();
});
it("clears a declined or completed offer", () => {
  rememberInvitation("WELCOME");
  rememberInvitation(null);
  expect(pendingInvitation()).toBeNull();
});
it("migrates the existing session-only code", () => {
  sessionStorage.setItem("ucat:pending-invitation", "WELCOME");
  expect(pendingInvitation()).toBe("WELCOME");
  sessionStorage.clear();
  expect(pendingInvitation()).toBe("WELCOME");
});
