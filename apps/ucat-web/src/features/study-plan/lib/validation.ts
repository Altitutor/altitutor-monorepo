import type {
  StudyPlanAvailability,
  StudyPlanExtraStudyInput,
  StudyPlanProfileInput,
  StudyPlanSection,
  StudyPlanWeekday,
} from "@/features/study-plan/model/types";
import { parseIsoDate } from "@/features/study-plan/lib/dates";

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
  return value;
}

const EXTRA_STUDY_MINUTES = new Set([10, 20, 30, 45]);
const SECTION_KEYS = new Set<StudyPlanSection["key"]>([
  "verbal_reasoning",
  "decision_making",
  "quantitative_reasoning",
  "situational_judgement",
]);

export function parseExtraStudyInput(value: unknown): StudyPlanExtraStudyInput {
  if (!value || typeof value !== "object") {
    throw new Error("Choose how much time you have.");
  }
  const record = value as Record<string, unknown>;
  const minutes = integer(record.minutes, "Extra study time");
  if (!EXTRA_STUDY_MINUTES.has(minutes)) {
    throw new Error("Choose 10, 20, 30, or 45 minutes.");
  }
  const sectionKey = record.sectionKey == null ? null : String(record.sectionKey);
  if (
    sectionKey != null &&
    !SECTION_KEYS.has(sectionKey as StudyPlanSection["key"])
  ) {
    throw new Error("Choose a valid UCAT section.");
  }
  return {
    minutes: minutes as StudyPlanExtraStudyInput["minutes"],
    sectionKey: sectionKey as StudyPlanExtraStudyInput["sectionKey"],
  };
}

export function parseStudyPlanProfileInput(value: unknown): StudyPlanProfileInput {
  if (!value || typeof value !== "object") throw new Error("Invalid Study plan settings.");
  const record = value as Record<string, unknown>;
  const targetScore = integer(record.targetScore, "Target score");
  if (targetScore < 900 || targetScore > 2700 || targetScore % 10 !== 0) {
    throw new Error("Target score must be between 900 and 2700, in 10-point increments.");
  }
  const testYear = integer(record.testYear, "Test year");
  if (testYear < new Date().getUTCFullYear() || testYear > new Date().getUTCFullYear() + 3) {
    throw new Error("Choose a valid upcoming UCAT year.");
  }
  const testDate = record.testDate == null || record.testDate === ""
    ? null
    : String(record.testDate);
  if (testDate) {
    parseIsoDate(testDate);
    if (Number(testDate.slice(0, 4)) !== testYear) {
      throw new Error("Test date must be in the selected test year.");
    }
  }
  if (!Array.isArray(record.availableDays)) {
    throw new Error("Choose at least one available study day.");
  }
  const availableDays: StudyPlanAvailability[] = record.availableDays.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid available day.");
    const day = item as Record<string, unknown>;
    const weekday = integer(day.weekday, "Weekday");
    const maxMinutes = integer(day.maxMinutes, "Daily time");
    if (weekday < 0 || weekday > 6) throw new Error("Invalid weekday.");
    if (maxMinutes < 15 || maxMinutes > 360) {
      throw new Error("Daily study time must be between 15 minutes and 6 hours.");
    }
    return { weekday: weekday as StudyPlanWeekday, maxMinutes };
  });
  if (availableDays.length < 1 || availableDays.length > 7) {
    throw new Error("Choose between one and seven available study days.");
  }
  if (new Set(availableDays.map((day) => day.weekday)).size !== availableDays.length) {
    throw new Error("Each available day can only be selected once.");
  }
  const preferredMockWeekday = integer(record.preferredMockWeekday, "Mock day");
  if (preferredMockWeekday < 0 || preferredMockWeekday > 6) {
    throw new Error("Choose a valid preferred mock day.");
  }
  if (!availableDays.some((day) => day.weekday === preferredMockWeekday)) {
    throw new Error("Your preferred mock day must be one of your available days.");
  }
  return {
    targetScore,
    testYear,
    testDate,
    availableDays,
    preferredMockWeekday: preferredMockWeekday as StudyPlanWeekday,
  };
}
