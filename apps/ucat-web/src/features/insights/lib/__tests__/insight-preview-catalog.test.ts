import { INSIGHT_PREVIEW_CATALOG } from "../insight-preview-catalog";

describe("insight preview catalogue", () => {
  it("includes every insight family with globally unique rule identities", () => {
    expect(
      new Set(INSIGHT_PREVIEW_CATALOG.map(({ family }) => family)),
    ).toEqual(
      new Set([
        "Attempt",
        "Dashboard setup",
        "Dashboard trajectory",
        "Mock trajectory",
        "Question",
        "Section score",
        "Section timing",
        "Total score",
      ]),
    );

    const ruleIds = INSIGHT_PREVIEW_CATALOG.map(({ ruleId }) => ruleId);
    expect(new Set(ruleIds).size).toBe(ruleIds.length);
  });
});
