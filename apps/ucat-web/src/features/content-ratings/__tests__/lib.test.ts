import { contentSnapshotVersion } from "../lib";

describe("UCAT content rating identities", () => {
  it("produces the same version regardless of object key order", () => {
    expect(contentSnapshotVersion({ title: "A title", body: "A body" })).toBe(
      contentSnapshotVersion({ body: "A body", title: "A title" }),
    );
  });

  it("changes version when displayed wording changes", () => {
    expect(contentSnapshotVersion({ body: "First wording" })).not.toBe(
      contentSnapshotVersion({ body: "Revised wording" }),
    );
  });
});
