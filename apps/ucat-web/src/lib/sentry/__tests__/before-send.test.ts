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

it.each([
  'Unexpected failure after Invalid login credentials',
  'permission denied for function ucat_study_plan_task_has_active_work',
  'invalid_study_plan_task',
  'HTTP 400: database schema mismatch',
  'Failed to fetch',
  'ValidationError: server response does not match schema',
])('retains unconfirmed failures: %s', (message) => {
  const event = { exception: { values: [{ value: message }] } };
  expect(filterExpectedUcatWebError(event)).toBe(event);
});
it('retains an unexpected exception alongside an expected cause', () => {
  const event = { exception: { values: [{ value: 'Unexpected study-plan failure' }, { value: 'Invalid login credentials' }] } };
  expect(filterExpectedUcatWebError(event)).toBe(event);
});
