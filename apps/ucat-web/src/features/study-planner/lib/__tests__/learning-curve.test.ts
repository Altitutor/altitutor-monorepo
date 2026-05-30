jest.mock("ml-levenberg-marquardt", () => ({
  levenbergMarquardt: () => ({
    parameterValues: [760, 0.00015],
    parameterError: 0,
    iterations: 3,
  }),
}));

import { fitCurve, projectScore } from "../learning-curve";

describe("learning-curve", () => {
  it("returns prior defaults with low observations", () => {
    const fit = fitCurve([{ q: 0, score: 500 }], 500, 0.00013, 130);

    expect(fit.k).toBeGreaterThan(0);
    expect(fit.sInf).toBeGreaterThan(500);
  });

  it("fits a reasonable curve for improving data", () => {
    const fit = fitCurve(
      [
        { q: 0, score: 500 },
        { q: 120, score: 560 },
        { q: 260, score: 610 },
        { q: 420, score: 650 },
        { q: 600, score: 680 },
      ],
      500,
      0.00013,
      130,
    );

    expect(fit.sInf).toBeGreaterThan(650);
    expect(fit.sInf).toBeLessThanOrEqual(900);
    expect(fit.k).toBeGreaterThan(0);
  });

  it("projects score bounded in UCAT range", () => {
    const projected = projectScore(500, 820, 0.0002, 620, 300, 900);
    expect(projected).toBeGreaterThanOrEqual(300);
    expect(projected).toBeLessThanOrEqual(900);
  });
});
