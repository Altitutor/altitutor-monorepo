import { dynamic } from "../page";

describe("/signup/complete rendering contract", () => {
  it("is never prerendered without the request's auth cookies", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
