import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { requestOperationalEmail } from "../operational";
const originalFetch = global.fetch;
const originalCrypto = global.crypto;
afterEach(() => {
  global.fetch = originalFetch;
  Object.defineProperty(global, "crypto", {
    configurable: true,
    value: originalCrypto,
  });
  sessionStorage.clear();
});
it("retains one operational delivery intent after a lost response and starts a new intent after success", async () => {
  Object.defineProperty(global, "TextEncoder", {
    configurable: true,
    value: TextEncoder,
  });
  Object.defineProperty(global, "crypto", {
    configurable: true,
    value: webcrypto,
  });
  const tokens: string[] = [];
  let calls = 0;
  global.fetch = jest.fn(async (_url, init) => {
    tokens.push(new Headers(init?.headers).get("Idempotency-Key")!);
    if (++calls === 1) throw new Error("Connection lost after submission");
    return {
      ok: true,
      clone: () => ({ json: async () => ({ success: true }) }),
    } as Response;
  });
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId: "student-fixture", sendEmail: true }),
  };
  await expect(
    requestOperationalEmail("/api/students/send-registration-invite", init),
  ).rejects.toThrow("Connection lost");
  await requestOperationalEmail("/api/students/send-registration-invite", init);
  await requestOperationalEmail("/api/students/send-registration-invite", init);
  expect(tokens[0]).toBeTruthy();
  expect(tokens[1]).toBe(tokens[0]);
  expect(tokens[2]).not.toBe(tokens[0]);
});
