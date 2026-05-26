jest.mock("ml-levenberg-marquardt", () => ({
  levenbergMarquardt: () => ({
    parameterValues: [760, 0.00015],
    parameterError: 0,
    iterations: 3,
  }),
}));

import { generateProjection } from "../score-projection";

describe("generateProjection", () => {
  it("returns daily series from today to test date", () => {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 5);

    const projection = generateProjection({
      state: {
        s0: 500,
        sInf: 760,
        k: 0.00015,
        sHat: 610,
        p: 900,
        questionsCumulative: 300,
      },
      testDate,
      questionsPerDay: 60,
    });

    expect(projection.length).toBe(6);
    expect(projection[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns empty series for past date", () => {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - 1);

    const projection = generateProjection({
      state: {
        s0: 500,
        sInf: 760,
        k: 0.00015,
        sHat: 610,
        p: 900,
        questionsCumulative: 300,
      },
      testDate,
      questionsPerDay: 60,
    });

    expect(projection).toEqual([]);
  });
});
