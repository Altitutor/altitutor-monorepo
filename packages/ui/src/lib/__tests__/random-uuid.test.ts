import { isUuidV4, randomUuid } from "../random-uuid";

describe("randomUuid", () => {
  it("returns a version 4 UUID when crypto.randomUUID exists", () => {
    expect(isUuidV4(randomUuid())).toBe(true);
  });

  it("builds a version 4 UUID from getRandomValues when randomUUID is missing", () => {
    const cryptoObject = globalThis.crypto as Crypto & { randomUUID?: Crypto["randomUUID"] };
    const original = cryptoObject.randomUUID;
    Object.defineProperty(cryptoObject, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    try {
      expect(typeof cryptoObject.randomUUID).not.toBe("function");
      expect(isUuidV4(randomUuid())).toBe(true);
    } finally {
      Object.defineProperty(cryptoObject, "randomUUID", {
        configurable: true,
        value: original,
      });
    }
  });
});
