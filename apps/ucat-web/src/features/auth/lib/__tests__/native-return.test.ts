import { nativeReturnUrl, validNativeNonce } from "../native-return";
describe("native callback boundary", () => {
  it("only accepts the exact installed app callback", () => {
    expect(nativeReturnUrl("altitutor-ucat://auth-return")).toBe(
      "altitutor-ucat://auth-return",
    );
    for (const value of [
      "https://evil.example",
      "altitutor-ucat://other",
      "altitutor-ucat://user:pass@auth-return",
      "altitutor-ucat://auth-return?next=evil",
      "altitutor-ucat://auth-return#ticket=x",
    ])
      expect(nativeReturnUrl(value)).toBeNull();
  });
  it("allows Expo Go LAN callbacks only in development", () => {
    expect(
      nativeReturnUrl("exp://192.168.1.2:8081/--/auth-return", true),
    ).not.toBeNull();
    expect(nativeReturnUrl("exp://192.168.1.2:8081/--/auth-return")).toBeNull();
    expect(
      nativeReturnUrl("exp://evil.example:8081/--/auth-return", true),
    ).toBeNull();
  });
  it("requires full random base64url state and challenge values", () => {
    expect(validNativeNonce("a".repeat(43))).toBe(true);
    expect(validNativeNonce("short")).toBe(false);
    expect(validNativeNonce("a".repeat(42) + "+")).toBe(false);
  });
});
