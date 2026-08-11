import { CURRENT_PREPARATION_VERSIONS } from "@/features/preparation";
import {
  allocateTotalAcrossSections,
  readCompatibleCanonicalTrajectory,
} from "@/features/score-projection/lib/canonical-trajectory-adapter";

describe("canonical trajectory score-projection adapter", () => {
  it("preserves each canonical total exactly within section bounds", () => {
    const estimates = [
      { sectionId: "vr", currentEstimate: 500 },
      { sectionId: "dm", currentEstimate: 600 },
      { sectionId: "qr", currentEstimate: 700 },
    ];

    for (const total of [1500, 1800, 2100, 2500]) {
      const allocated = allocateTotalAcrossSections(total, estimates);
      expect(Object.values(allocated).reduce((sum, value) => sum + value, 0)).toBe(
        total,
      );
      expect(Object.values(allocated).every((value) => value >= 300 && value <= 900))
        .toBe(true);
    }
  });

  it("accepts only snapshots matching the complete canonical version tuple", () => {
    const snapshot = {
      versions: CURRENT_PREPARATION_VERSIONS,
      trajectory: {
        status: "unavailable",
        reason: "no_future_dose",
        modelVersion: CURRENT_PREPARATION_VERSIONS.trajectoryModel,
        history: [],
        points: [],
      },
    };

    expect(
      readCompatibleCanonicalTrajectory(
        snapshot,
        CURRENT_PREPARATION_VERSIONS,
      ),
    ).toEqual(snapshot.trajectory);
    expect(
      readCompatibleCanonicalTrajectory(
        {
          ...snapshot,
          versions: {
            ...CURRENT_PREPARATION_VERSIONS,
            engine: "incompatible-engine-v0",
          },
        },
        CURRENT_PREPARATION_VERSIONS,
      ),
    ).toBeNull();
  });
});
