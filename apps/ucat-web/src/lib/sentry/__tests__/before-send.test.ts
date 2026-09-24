import { filterExpectedUcatWebError } from "../before-send";

describe("filterExpectedUcatWebError", () => {
  it.each([
    'QUOTA_EXCEEDED:{"area": "practice", "code": "QUOTA_EXCEEDED", "used": 11, "limit": 10, "period": "day"}',
    "Invalid login credentials",
    "Non-Error promise rejection captured with value: Object Not Found Matching Id:2, MethodName:update, ParamCount:4",
  ])("drops the expected outcome %s", (message) => {
    const event = { exception: { values: [{ value: message }] } };

    expect(filterExpectedUcatWebError(event)).toBeNull();
  });

  it("keeps unexpected database failures", () => {
    const event = {
      exception: { values: [{ value: "permission denied for table students" }] },
    };

    expect(filterExpectedUcatWebError(event)).toBe(event);
  });
});
