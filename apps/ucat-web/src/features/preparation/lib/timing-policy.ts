import { addDays, daysBetween, weekday } from "@/features/study-plan/lib/dates";
import type {
  StudyPlanProfileInput,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanTimingDecisionCode,
  StudyPlanTimingEvidenceSession,
} from "@/features/study-plan/model/types";

export const TIMING_PACE_RUNGS = [0.5, 0.6, 0.7, 0.8, 0.9, 1] as const;
const ACCURACY_FLOOR = 0.65;
const ACCURACY_TOLERANCE = 0.05;
const NORMAL_MIN_SESSIONS = 3;
const NORMAL_MIN_EFFECTIVE_EQUIVALENTS = 1;
const NORMAL_MIN_BROAD_EQUIVALENTS = 0.75;
const NARROW_CREDIT_MULTIPLIER = 0.25;
const NARROW_CREDIT_CAP = 0.25;
const STRONG_1X_ACCURACY = 0.75;
const CALIBRATION_TARGETED_EQUIVALENTS = 1.5;
const STALE_CALIBRATION_DAYS = 21;
const STALE_CALIBRATION_MIN_EQUIVALENTS = 0.5;
const DEADLINE_SESSIONS_PER_RUNG = 2;
const DEADLINE_ADVANCE_COOLDOWN_DAYS = 7;

export type TimingPolicyAssessment = {
  prescribedPace: number;
  decisionCode: StudyPlanTimingDecisionCode;
  advanceFrom: number | null;
  advanceTo: number | null;
  capacityConstrained: boolean;
  calibrationDue: boolean;
  overspeedEligible: boolean;
  overspeedPace: number | null;
  qualifyingSessionCount: number;
  effectiveSectionEquivalents: number;
  broadSectionEquivalents: number;
  weightedAccuracy: number | null;
};

function floorRung(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return TIMING_PACE_RUNGS[0];
  const clamped = Math.max(0.5, Math.min(1, value));
  return (
    [...TIMING_PACE_RUNGS].reverse().find((rung) => rung <= clamped + 0.001) ??
    TIMING_PACE_RUNGS[0]
  );
}

function nextRung(value: number): number {
  return (
    TIMING_PACE_RUNGS.find((rung) => rung > value + 0.001) ??
    TIMING_PACE_RUNGS[TIMING_PACE_RUNGS.length - 1]
  );
}

function initialPlacement(signal: StudyPlanSectionSignal | undefined): number {
  const natural = floorRung(signal?.observedPace);
  const accuracy = signal?.recentAccuracy ?? signal?.benchmarkAccuracy ?? null;
  if (accuracy == null || accuracy >= ACCURACY_FLOOR) return natural;
  const penalty = accuracy < 0.5 ? 0.2 : 0.1;
  return floorRung(natural - penalty);
}

function weightedAccuracy(
  sessions: StudyPlanTimingEvidenceSession[],
): number | null {
  let score = 0;
  let weight = 0;
  for (const session of sessions) {
    if (session.accuracy == null || !Number.isFinite(session.accuracy))
      continue;
    const sessionWeight = Math.max(0, session.sectionEquivalents);
    score += session.accuracy * sessionWeight;
    weight += sessionWeight;
  }
  return weight > 0 ? score / weight : null;
}

function effectiveEvidence(sessions: StudyPlanTimingEvidenceSession[]): {
  effective: number;
  broad: number;
} {
  let broad = 0;
  let narrow = 0;
  for (const session of sessions) {
    const equivalents = Math.max(0, session.sectionEquivalents);
    if (session.breadth === "narrow") {
      narrow += equivalents * NARROW_CREDIT_MULTIPLIER;
    } else {
      broad += equivalents;
    }
  }
  return {
    broad,
    effective: broad + Math.min(NARROW_CREDIT_CAP, narrow),
  };
}

function strongOneTimesSessions(
  sessions: StudyPlanTimingEvidenceSession[],
): StudyPlanTimingEvidenceSession[] {
  return sessions.filter(
    (session) =>
      session.breadth !== "narrow" &&
      (session.prescribedPace ?? session.observedPace ?? 0) >= 0.95 &&
      (session.accuracy ?? 0) >= STRONG_1X_ACCURACY,
  );
}

function selectedOpportunitiesBeforeExamPhase(input: {
  today: string;
  planningDate: string;
  profile: StudyPlanProfileInput;
}): number {
  const lastTimingDate = addDays(input.planningDate, -61);
  if (lastTimingDate < input.today) return 0;
  const available = new Set(
    input.profile.availableDays.map((day) => day.weekday),
  );
  let result = 0;
  for (
    let cursor = input.today;
    cursor <= lastTimingDate;
    cursor = addDays(cursor, 1)
  ) {
    if (available.has(weekday(cursor))) result += 1;
  }
  return result;
}

function evidenceSinceRung(
  sessions: StudyPlanTimingEvidenceSession[],
  setAt: string | null | undefined,
): StudyPlanTimingEvidenceSession[] {
  if (!setAt) return sessions;
  return sessions.filter((session) => session.completedAt > setAt);
}

function calibrationDue(
  sessions: StudyPlanTimingEvidenceSession[],
  today: string,
): boolean {
  const ordered = [...sessions].sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt),
  );
  const lastRepresentative = ordered.find(
    (session) =>
      session.source === "mock" ||
      (session.breadth !== "narrow" && session.sectionEquivalents >= 0.9),
  );
  const targetedAfter = ordered.filter(
    (session) =>
      session.source === "practice" &&
      (!lastRepresentative ||
        session.completedAt > lastRepresentative.completedAt),
  );
  const targetedEquivalents = targetedAfter.reduce(
    (sum, session) => sum + Math.max(0, session.sectionEquivalents),
    0,
  );
  if (targetedEquivalents >= CALIBRATION_TARGETED_EQUIVALENTS) return true;
  if (!lastRepresentative)
    return targetedEquivalents >= STALE_CALIBRATION_MIN_EQUIVALENTS;
  const age = daysBetween(lastRepresentative.completedAt.slice(0, 10), today);
  return (
    age >= STALE_CALIBRATION_DAYS &&
    targetedEquivalents >= STALE_CALIBRATION_MIN_EQUIVALENTS
  );
}

export function assessTimingPolicy(input: {
  today: string;
  planningDate: string;
  profile: StudyPlanProfileInput;
  section: StudyPlanSection;
  signal: StudyPlanSectionSignal | undefined;
  sessions: StudyPlanTimingEvidenceSession[];
  canPersistPace: boolean;
}): TimingPolicyAssessment {
  const persisted =
    input.signal?.prescribedPace == null
      ? null
      : floorRung(input.signal.prescribedPace);
  const prescribed = persisted ?? initialPlacement(input.signal);
  const sinceRung = evidenceSinceRung(
    input.sessions,
    input.signal?.prescribedPaceSetAt,
  );
  const atRung = sinceRung.filter((session) => {
    const attemptedPace = session.prescribedPace ?? session.observedPace;
    return attemptedPace != null && attemptedPace + 0.051 >= prescribed;
  });
  const effective = effectiveEvidence(atRung);
  const currentAccuracy = weightedAccuracy(atRung);
  const baselineAccuracy =
    input.signal?.benchmarkAccuracy ?? input.signal?.recentAccuracy ?? null;
  const accuracyPreserved =
    currentAccuracy != null &&
    currentAccuracy >= ACCURACY_FLOOR &&
    (baselineAccuracy == null ||
      currentAccuracy >= baselineAccuracy - ACCURACY_TOLERANCE);
  const strongAtOne = strongOneTimesSessions(input.sessions);
  const strongAtOneEquivalents = strongAtOne.reduce(
    (sum, session) => sum + session.sectionEquivalents,
    0,
  );
  const accelerated =
    prescribed < 1 &&
    strongAtOne.length >= 2 &&
    strongAtOneEquivalents >= 1 &&
    Math.max(...strongAtOne.map((session) => session.accuracy ?? 0)) -
      Math.min(...strongAtOne.map((session) => session.accuracy ?? 0)) <=
      0.12;
  const normal =
    prescribed < 1 &&
    atRung.length >= NORMAL_MIN_SESSIONS &&
    effective.effective >= NORMAL_MIN_EFFECTIVE_EQUIVALENTS &&
    effective.broad >= NORMAL_MIN_BROAD_EQUIVALENTS &&
    accuracyPreserved;
  const opportunities = selectedOpportunitiesBeforeExamPhase(input);
  const remainingRungs = TIMING_PACE_RUNGS.filter(
    (rung) => rung > prescribed + 0.001,
  ).length;
  const capacityConstrained =
    remainingRungs > 0 &&
    opportunities < remainingRungs * DEADLINE_SESSIONS_PER_RUNG;
  const daysAtRung = input.signal?.prescribedPaceSetAt
    ? daysBetween(input.signal.prescribedPaceSetAt.slice(0, 10), input.today)
    : Number.POSITIVE_INFINITY;
  const deadlineAdvance =
    prescribed < 1 &&
    capacityConstrained &&
    daysAtRung >= DEADLINE_ADVANCE_COOLDOWN_DAYS;

  let advanceTo: number | null = null;
  let decisionCode: StudyPlanTimingDecisionCode;
  if (!input.canPersistPace && persisted == null) {
    decisionCode = "timing.initial_placement";
  } else if (prescribed >= 1) {
    decisionCode = "timing.at_exam_pace";
  } else if (accelerated) {
    advanceTo = 1;
    decisionCode = "timing.advance_accelerated_1x";
  } else if (normal) {
    advanceTo = nextRung(prescribed);
    decisionCode = "timing.advance_normal";
  } else if (deadlineAdvance) {
    advanceTo = nextRung(prescribed);
    decisionCode = "timing.advance_deadline";
  } else if (
    atRung.length >= NORMAL_MIN_SESSIONS &&
    effective.effective >= NORMAL_MIN_EFFECTIVE_EQUIVALENTS &&
    !accuracyPreserved
  ) {
    decisionCode = "timing.hold_accuracy";
  } else if (persisted == null) {
    decisionCode = "timing.initial_placement";
  } else {
    decisionCode = "timing.hold_insufficient_evidence";
  }

  return {
    prescribedPace: advanceTo ?? prescribed,
    decisionCode,
    advanceFrom: advanceTo == null ? null : prescribed,
    advanceTo,
    capacityConstrained,
    calibrationDue: calibrationDue(input.sessions, input.today),
    overspeedEligible:
      (advanceTo ?? prescribed) === 1 &&
      strongAtOne.length >= 2 &&
      strongAtOneEquivalents >= 1,
    overspeedPace:
      (advanceTo ?? prescribed) === 1 &&
      strongAtOne.length >= 2 &&
      strongAtOneEquivalents >= 1
        ? strongAtOne.length >= 6
          ? 1.3
          : strongAtOne.length >= 4
            ? 1.2
            : 1.1
        : null,
    qualifyingSessionCount: atRung.length,
    effectiveSectionEquivalents: effective.effective,
    broadSectionEquivalents: effective.broad,
    weightedAccuracy: currentAccuracy,
  };
}
