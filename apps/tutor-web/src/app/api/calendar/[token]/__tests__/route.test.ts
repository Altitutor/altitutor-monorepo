/** @jest-environment node */

import { fetchCache } from "../route";

describe("GET /api/calendar/[token]", () => {
  it("fetches current session assignments on every calendar provider poll", () => {
    expect(fetchCache).toBe("force-no-store");
  });
});
