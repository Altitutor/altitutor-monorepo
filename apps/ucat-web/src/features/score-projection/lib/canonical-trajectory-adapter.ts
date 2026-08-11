import type {
  PreparationTrajectory,
  PreparationVersions,
} from "@/features/preparation/model/types";

export type CognitiveSectionEstimate = {
  sectionId: string;
  currentEstimate: number;
};

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readCompatibleCanonicalTrajectory(
  value: unknown,
  expected: PreparationVersions,
): PreparationTrajectory | null {
  const snapshot = record(value);
  const versions = record(snapshot?.versions);
  const trajectory = record(snapshot?.trajectory);
  if (
    versions?.engine !== expected.engine ||
    versions.policy !== expected.policy ||
    versions.scoreModel !== expected.scoreModel ||
    versions.trajectoryModel !== expected.trajectoryModel ||
    trajectory?.modelVersion !== expected.trajectoryModel ||
    (trajectory.status !== "available" && trajectory.status !== "unavailable")
  ) {
    return null;
  }
  return snapshot!.trajectory as PreparationTrajectory;
}

/**
 * Allocate one canonical total-trajectory point across cognitive sections for
 * legacy chart consumers while preserving the total exactly.
 */
export function allocateTotalAcrossSections(
  total: number,
  estimates: CognitiveSectionEstimate[],
): Record<string, number> {
  const currentTotal = estimates.reduce(
    (sum, section) => sum + section.currentEstimate,
    0,
  );
  const difference = total - currentTotal;
  const room = estimates.map((section) =>
    difference >= 0
      ? 900 - section.currentEstimate
      : section.currentEstimate - 300,
  );
  const totalRoom = room.reduce((sum, value) => sum + value, 0);
  const allocated = estimates.map((section, index) =>
    Math.round(
      section.currentEstimate +
        difference *
          (totalRoom > 0 ? room[index]! / totalRoom : 1 / estimates.length),
    ),
  );
  let remainder = total - allocated.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  while (remainder !== 0 && cursor < 100) {
    const index = cursor % allocated.length;
    const step = Math.sign(remainder);
    const next = allocated[index]! + step;
    if (next >= 300 && next <= 900) {
      allocated[index] = next;
      remainder -= step;
    }
    cursor += 1;
  }
  return Object.fromEntries(
    estimates.map((section, index) => [section.sectionId, allocated[index]!]),
  );
}
