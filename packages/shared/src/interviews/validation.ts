import type { InterviewCommand } from "./index";

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text = (v: unknown, max = 500): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const version = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const number = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const array = (
  v: unknown,
  validate: (item: unknown) => boolean,
  max = 500,
): boolean => Array.isArray(v) && v.length <= max && v.every(validate);
const unique = (values: unknown[]) => new Set(values).size === values.length;
// A bounded JSON document accepts Tiptap nodes and plain text while rejecting
// executable/non-JSON values and pathological recursion before Postgres sees it.
function rich(v: unknown, depth = 0): boolean {
  if (depth > 30) return false;
  if (v === null || typeof v === "boolean" || typeof v === "number")
    return typeof v !== "number" || Number.isFinite(v);
  if (typeof v === "string") return v.length <= 100_000;
  if (Array.isArray(v))
    return v.length <= 2_000 && v.every((x) => rich(x, depth + 1));
  return (
    record(v) &&
    Object.keys(v).length <= 100 &&
    Object.values(v).every((x) => rich(x, depth + 1))
  );
}
function station(v: unknown): boolean {
  return record(v) && uuid(v.id) && uuid(v.stationId);
}
function bankStation(v: unknown): boolean {
  return (
    record(v) &&
    uuid(v.id) &&
    text(v.name) &&
    uuid(v.categoryId) &&
    rich(v.prompt) &&
    number(v.maximumPoints, 0.01, 1000) &&
    typeof v.archived === "boolean" &&
    array(
      v.questions,
      (q) =>
        record(q) &&
        uuid(q.id) &&
        q.stationId === v.id &&
        array(q.tagIds, uuid) &&
        Array.isArray(q.tagIds) &&
        unique(q.tagIds) &&
        rich(q.question) &&
        rich(q.rubric) &&
        number(q.suggestedTimeSeconds, 1, 7200) &&
        Number.isInteger(q.suggestedTimeSeconds),
      100,
    ) &&
    Array.isArray(v.questions) &&
    v.questions.length > 0 &&
    unique(v.questions.map((q: RecordValue) => q.id))
  );
}
function setup(v: unknown): boolean {
  return (
    record(v) &&
    uuid(v.interviewId) &&
    text(v.name) &&
    ["online", "in_person"].includes(String(v.delivery)) &&
    ["exam", "feedback"].includes(String(v.mode)) &&
    typeof v.recordingEnabled === "boolean" &&
    (v.scheduledAt === null ||
      (typeof v.scheduledAt === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(v.scheduledAt) &&
        Number.isFinite(Date.parse(v.scheduledAt)))) &&
    array(v.studentIds, uuid, 6) &&
    Array.isArray(v.studentIds) &&
    v.studentIds.length > 0 &&
    unique(v.studentIds) &&
    array(
      v.assignments,
      (a) => record(a) && uuid(a.stationId) && uuid(a.tutorId),
      6,
    ) &&
    Array.isArray(v.assignments) &&
    v.assignments.length > 0
  );
}
/** HTTP boundary validation. Authorization, current versions and cross-row
 * invariants remain enforced by the transactional database command. */
export function isInterviewCommand(value: unknown): value is InterviewCommand {
  if (
    !record(value) ||
    !uuid(value.commandId) ||
    typeof value.type !== "string"
  )
    return false;
  switch (value.type) {
    case "saveCategory":
      return (
        record(value.category) &&
        uuid(value.category.id) &&
        text(value.category.name) &&
        (value.category.parentId === null || uuid(value.category.parentId))
      );
    case "saveTag":
      return record(value.tag) && uuid(value.tag.id) && text(value.tag.name);
    case "saveStation":
      return version(value.expectedVersion) && bankStation(value.station);
    case "saveRubric":
      return (
        version(value.expectedVersion) &&
        uuid(value.stationId) &&
        uuid(value.questionId) &&
        rich(value.rubric)
      );
    case "saveInterview": {
      const i = value.interview;
      return (
        version(value.expectedVersion) &&
        record(i) &&
        uuid(i.id) &&
        text(i.name) &&
        number(i.readingTimeSeconds, 1, 3600) &&
        Number.isInteger(i.readingTimeSeconds) &&
        number(i.questionTimeSeconds, 1, 7200) &&
        Number.isInteger(i.questionTimeSeconds) &&
        typeof i.recordingEnabled === "boolean" &&
        typeof i.archived === "boolean" &&
        array(i.stations, station, 6)
      );
    }
    case "createRound":
      return uuid(value.roundId) && setup(value.setup);
    case "updateRound":
      return (
        uuid(value.roundId) &&
        version(value.expectedVersion) &&
        setup(value.setup)
      );
    case "heartbeat":
    case "tick":
      return uuid(value.roundId);
    case "saveAttempt":
      return (
        uuid(value.roundId) &&
        uuid(value.attemptId) &&
        version(value.expectedAttemptVersion) &&
        (value.score === null || number(value.score, 0, 1000)) &&
        (value.notAssessedReason === null ||
          text(value.notAssessedReason, 2000)) &&
        (value.generalFeedback === undefined || rich(value.generalFeedback)) &&
        array(
          value.feedback,
          (f) => record(f) && uuid(f.placementId) && rich(f.value),
          100,
        )
      );
    case "ready":
      return (
        uuid(value.roundId) &&
        version(value.expectedVersion) &&
        typeof value.ready === "boolean"
      );
    case "claimStudent":
      return (
        uuid(value.roundId) &&
        version(value.expectedVersion) &&
        (value.studentId === null || uuid(value.studentId)) &&
        (value.confirmMove === undefined ||
          typeof value.confirmMove === "boolean")
      );
    case "startReading":
      return (
        uuid(value.roundId) &&
        version(value.expectedVersion) &&
        (value.overrideMissingStudents === undefined ||
          typeof value.overrideMissingStudents === "boolean")
      );
    case "start":
    case "pause":
    case "resume":
    case "skipReading":
    case "next":
    case "release":
    case "endStation":
    case "finishFeedback":
      return uuid(value.roundId) && version(value.expectedVersion);
    default:
      return false;
  }
}
