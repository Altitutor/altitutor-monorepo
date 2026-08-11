import { onlySnapshotsForModel } from "../snapshot-history";

describe("score snapshot history", () => {
  it("never splices snapshots from incompatible model versions", () => {
    const active = onlySnapshotsForModel(
      [
        { date: "2026-08-10", model_version: "legacy-score-v1" },
        { date: "2026-08-11", model_version: "representative-score-v1" },
      ],
      "representative-score-v1",
    );

    expect(active).toEqual([
      { date: "2026-08-11", model_version: "representative-score-v1" },
    ]);
  });
});
