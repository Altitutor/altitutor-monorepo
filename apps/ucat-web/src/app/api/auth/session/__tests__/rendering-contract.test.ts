/** @jest-environment node */

import { dynamic } from "../route";

describe("/api/auth/session rendering contract", () => {
  it("is never cached as an anonymous session response", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
