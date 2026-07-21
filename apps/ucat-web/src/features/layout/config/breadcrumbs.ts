import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";

/** Maps path segments to display labels for breadcrumbs. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "study-plan": "Study plan",
  progress: "Progress",
  sets: "Sets",
  sections: "Sections",
  mocks: "Mocks",
  learn: "Learn",
  sessions: "Sessions",
  practice: "Practice questions",
  settings: "Settings",
  app: "App settings",
  profile: "My profile",
  plan: "Plan",
  subscription: "Subscription",
  "skill-trainer": "Skill trainer",
  "set-attempts": "Set attempt",
  "mock-attempts": "Mock attempt",
  "practice-sessions": "Practice session",
};

/** Label for dynamic segments (UUIDs, etc.) when parent is known. */
const DYNAMIC_SEGMENT_LABELS: Record<string, string> = {
  sets: "Set",
  sections: "Section",
  mocks: "Mock",
  sessions: "Session",
  "set-attempts": "Set attempt",
  "mock-attempts": "Mock attempt",
  "practice-sessions": "Practice session",
  results: "Attempt",
};

const SKILL_TRAINER_SLUG_LABELS: Record<string, string> = {
  "find-word": "Find the word",
  "find-concept": "Find the concept",
  "quick-syllogism": "Quick syllogisms",
  "mental-maths": "Mental maths",
  "numpad-speed": "Numpad speed",
  "calculator-maths": "Calculator maths speed",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDynamicSegment(segment: string): boolean {
  return UUID_REGEX.test(segment) || /^\d+$/.test(segment);
}

/**
 * Paths that have actual pages. Intermediate segments (e.g. /progress/mocks/mock-attempts,
 * /progress/sections/[n]/set-attempts) are not valid - linking to them would 404.
 */
function isValidPagePath(path: string): boolean {
  if (!path || path === "/") return false;
  const segments = path.split("/").filter(Boolean);

  switch (segments.length) {
    case 1:
      return [
        "dashboard",
        "study-plan",
        "progress",
        "learn",
        "sessions",
        "practice",
        "skill-trainer",
        "sets",
        "mocks",
        "settings",
      ].includes(segments[0]);
    case 2:
      return (
        (segments[0] === "settings" &&
          ["app", "profile", "subscription", "plan", "study-plan"].includes(
            segments[1],
          )) ||
        (segments[0] === "progress" && segments[1] === "mocks") ||
        (segments[0] === "learn" && isDynamicSegment(segments[1])) ||
        (segments[0] === "sessions" && isDynamicSegment(segments[1])) ||
        (segments[0] === "sets" && isDynamicSegment(segments[1])) ||
        (segments[0] === "mocks" && isDynamicSegment(segments[1])) ||
        (segments[0] === "skill-trainer" && segments[1] !== "play") ||
        (segments[0] === "practice" &&
          (segments[1] === "session" || segments[1] === "stem"))
      );
    case 3:
      return (
        (segments[0] === "progress" &&
          [
            "set-attempts",
            "sections",
            "mock-attempts",
            "practice-sessions",
          ].includes(segments[1]) &&
          isDynamicSegment(segments[2])) ||
        (segments[0] === "sets" &&
          segments[1] === "sections" &&
          /^[1-4]$/.test(segments[2])) ||
        (segments[0] === "settings" &&
          segments[1] === "plan" &&
          segments[2] === "subscription") ||
        (segments[0] === "practice" &&
          segments[1] === "stem" &&
          isDynamicSegment(segments[2]))
      );
    case 4:
      return (
        (segments[0] === "skill-trainer" &&
          Boolean(SKILL_TRAINER_SLUG_LABELS[segments[1]]) &&
          segments[2] === "results" &&
          isDynamicSegment(segments[3])) ||
        (segments[0] === "sessions" &&
          isDynamicSegment(segments[1]) &&
          segments[2] === "sets" &&
          isDynamicSegment(segments[3])) ||
        (segments[0] === "sessions" &&
          isDynamicSegment(segments[1]) &&
          segments[2] === "mocks" &&
          isDynamicSegment(segments[3])) ||
        (segments[0] === "sets" &&
          segments[1] === "sections" &&
          /^[1-4]$/.test(segments[2]) &&
          isDynamicSegment(segments[3])) ||
        (segments[0] === "progress" &&
          segments[1] === "mocks" &&
          segments[2] === "mock-attempts" &&
          isDynamicSegment(segments[3]))
      );
    case 5:
      return (
        segments[0] === "progress" &&
        segments[1] === "sections" &&
        /^[1-4]$/.test(segments[2]) &&
        segments[3] === "set-attempts" &&
        isDynamicSegment(segments[4])
      );
    default:
      return false;
  }
}

/**
 * Returns the nearest valid page path that is an ancestor of or equal to the given path.
 */
function getEffectiveHref(path: string): string | null {
  const segments = path.split("/").filter(Boolean);
  for (let len = segments.length; len >= 1; len--) {
    const candidate = "/" + segments.slice(0, len).join("/");
    if (isValidPagePath(candidate)) return candidate;
  }
  return null;
}

export type BreadcrumbItem = {
  href: string;
  label: string;
  /** When set, this segment has no page - use effectiveHref for linking or render as text */
  effectiveHref: string | null;
};

/**
 * Builds breadcrumb items from a pathname.
 * Omits intermediate URL segments that are not real pages (e.g. "sections", "set-attempts").
 * Returns empty array for exam routes (question engine).
 */
export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  if (pathname.startsWith("/exam")) {
    return [];
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const items: BreadcrumbItem[] = [];
  let href = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    href += `/${segment}`;

    const isLastSegment = i === segments.length - 1;
    const hasOwnPage = isValidPagePath(href);
    if (!hasOwnPage && !isLastSegment) {
      continue;
    }

    let label =
      SEGMENT_LABELS[segment] ??
      (isDynamicSegment(segment)
        ? (DYNAMIC_SEGMENT_LABELS[segments[i - 1]] ?? "Detail")
        : segment);

    if (segments[0] === "skill-trainer" && i === 1) {
      label = SKILL_TRAINER_SLUG_LABELS[segment] ?? label;
    }

    // For /sets/sections/[1-4] or /progress/sections/[1-4], show section name (e.g. "Verbal Reasoning") instead of "Section"
    if (segments[1] === "sections" && i === 2 && /^[1-4]$/.test(segment)) {
      label = SECTION_NUMBER_TO_NAME[parseInt(segment, 10)] ?? label;
    }

    // For /sets/sections/[1-4]/[setId], show "Set" instead of "Detail"
    if (
      segments[0] === "sets" &&
      segments[1] === "sections" &&
      i >= 3 &&
      /^[1-4]$/.test(segments[2]) &&
      isDynamicSegment(segment)
    ) {
      label = "Set";
    }

    const effectiveHref = hasOwnPage ? href : getEffectiveHref(href);

    items.push({ href, label, effectiveHref });
  }

  return items;
}
