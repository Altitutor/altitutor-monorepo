import {
  contentSnapshotVersion,
  insightTargetKey,
} from "../lib";

describe("UCAT content rating identities", () => {
  it("produces the same version regardless of object key order", () => {
    expect(
      contentSnapshotVersion({ title: "A title", body: "A body" }),
    ).toBe(
      contentSnapshotVersion({ body: "A body", title: "A title" }),
    );
  });

  it("changes version when displayed wording changes", () => {
    expect(contentSnapshotVersion({ body: "First wording" })).not.toBe(
      contentSnapshotVersion({ body: "Revised wording" }),
    );
  });

  it("normalises dynamic numbers in an insight key", () => {
    expect(insightTargetKey("attempt", "Accuracy rose by 12 points")).toBe(
      insightTargetKey("attempt", "Accuracy rose by 28 points"),
    );
  });
});
