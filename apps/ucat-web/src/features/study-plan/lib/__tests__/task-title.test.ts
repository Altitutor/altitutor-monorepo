import {
  preferredCatalogAssetName,
  scheduledAssetTaskTitle,
} from "@/features/study-plan/lib/task-title";

describe("Study plan scheduled asset titles", () => {
  it("prefers the canonical catalogue display name over a legacy rich name", () => {
    expect(
      preferredCatalogAssetName({
        displayName: "Decision Making Full Set 4",
        richName: "DM set",
        fallback: "DM set",
      }),
    ).toBe("Decision Making Full Set 4");
  });

  it("replaces generic persisted set and mock titles with catalogue names", () => {
    expect(
      scheduledAssetTaskTitle({
        taskType: "section_benchmark",
        storedTitle: "DM set",
        assetName: "Decision Making Full Set 4",
        repeated: false,
      }),
    ).toBe("Decision Making Full Set 4");
    expect(
      scheduledAssetTaskTitle({
        taskType: "mock",
        storedTitle: "UCAT mock",
        assetName: "Mock 3",
        repeated: true,
      }),
    ).toBe("Repeat benchmark · Mock 3");
  });
});
