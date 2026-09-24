import {
  hasPasswordAuthHandoff,
  savePasswordAuthHandoff,
} from "@/features/auth/lib/password-auth-handoff";

describe("password auth handoff", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("is valid only for the user who authenticated with a password", () => {
    savePasswordAuthHandoff("user-a");

    expect(hasPasswordAuthHandoff("user-a")).toBe(true);
    expect(hasPasswordAuthHandoff("user-b")).toBe(false);
  });

  it("remains optional when session storage is unavailable", () => {
    const storageSpy = jest
      .spyOn(window, "sessionStorage", "get")
      .mockImplementation(() => {
        throw new DOMException("Storage disabled", "SecurityError");
      });

    expect(() => savePasswordAuthHandoff("user-a")).not.toThrow();
    expect(hasPasswordAuthHandoff("user-a")).toBe(false);

    storageSpy.mockRestore();
  });
});
