import { navigateToAttemptResults } from "../attempt-results-navigation";

describe("navigateToAttemptResults", () => {
  it("leaves the exam route atomically so its practice fallback cannot win", () => {
    const assign = jest.fn();

    navigateToAttemptResults("/progress/set-attempts/attempt-1", { assign });

    expect(assign).toHaveBeenCalledWith("/progress/set-attempts/attempt-1");
  });
});
