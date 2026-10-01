import { nativeReturnUrl, validNativeNonce } from "../native-return";

describe("native callback boundary", () => {
  it("only accepts the exact installed app callback", () => {
    expect(nativeReturnUrl("altitutor-student://auth-return")).toBe("altitutor-student://auth-return");
    for (const value of [
      "https://evil.example",
      "altitutor-student://other",
      "altitutor-student://user:pass@auth-return",
      "altitutor-student://auth-return?next=evil",
      "altitutor-student://auth-return#ticket=x",
      "altitutor-ucat://auth-return",
    ])
      expect(nativeReturnUrl(value)).toBeNull();
  });

  it("allows Expo Go LAN callbacks only in development", () => {
    expect(nativeReturnUrl("exp://192.168.1.2:8082/--/auth-return", true)).not.toBeNull();
    expect(nativeReturnUrl("exp://192.168.1.2:8082/--/auth-return")).toBeNull();
    expect(nativeReturnUrl("exp://evil.example:8082/--/auth-return", true)).toBeNull();
  });

  it("requires full random base64url state and challenge values", () => {
    expect(validNativeNonce("a".repeat(43))).toBe(true);
    expect(validNativeNonce("short")).toBe(false);
    expect(validNativeNonce("a".repeat(42) + "+")).toBe(false);
  });
});
