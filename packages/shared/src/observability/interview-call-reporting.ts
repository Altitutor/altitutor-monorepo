import type { InterviewCallFailure } from "../interviews/call-failures";

type Portal = "tutor-web" | "student-web";
const sources = ["sdk", "join", "recovery"];
const categories = ["connection", "configuration", "unknown"];
const phases = ["waiting", "reading", "questions", "feedback", "completed"];
const states = ["joining", "joined"];
const portals = ["tutor-web", "student-web"];

interface EventCandidate {
  event_id?: string;
  timestamp?: number;
  environment?: string;
  release?: string;
  tags?: Record<string, unknown>;
  contexts?: unknown;
}

/** Deliberately excludes inherited users, URLs, traces, SDK details and breadcrumbs. */
interface SafeCallEvent {
  type: undefined;
  event_id?: string;
  timestamp?: number;
  environment?: string;
  release?: string;
  platform: string;
  message: string;
  level: "error";
  fingerprint: string[];
  tags: Record<string, string>;
  contexts: { browser?: { name: string; version?: string } };
}

function validFailure(failure: InterviewCallFailure) {
  return (
    sources.includes(failure.source) &&
    categories.includes(failure.category) &&
    phases.includes(failure.phase) &&
    states.includes(failure.state)
  );
}

function safeEvent(app: Portal, failure: InterviewCallFailure): SafeCallEvent {
  return {
    type: undefined,
    platform: "javascript",
    message: "Interview call failed",
    level: "error",
    fingerprint: [
      "interview-call-failure",
      app,
      failure.source,
      failure.category,
    ],
    tags: {
      app,
      "interview.failure": "true",
      "interview.source": failure.source,
      "interview.category": failure.category,
      "interview.phase": failure.phase,
      "interview.state": failure.state,
    },
    contexts: {},
  };
}

/** Bounded per-tab reporting: one per kind/minute and at most three per five minutes. */
export function createInterviewCallReporter(
  app: Portal,
  capture: (event: SafeCallEvent) => unknown,
) {
  let windowStart = 0;
  let count = 0;
  const lastSent = new Map<string, number>();
  return (failure: InterviewCallFailure) => {
    try {
      if (!validFailure(failure)) return;
      const now = Date.now();
      if (now - windowStart >= 300_000 || now < windowStart) {
        windowStart = now;
        count = 0;
        lastSent.clear();
      }
      const key = `${failure.source}:${failure.category}`;
      const previous = lastSent.get(key);
      if (count >= 3 || (previous !== undefined && now - previous < 60_000))
        return;
      count += 1;
      lastSent.set(key, now);
      capture(safeEvent(app, failure));
    } catch {
      /* Reporting cannot interrupt the call's recovery path. */
    }
  };
}

/** Run last in each browser beforeSend, after the SDK has enriched the event. */
export function sanitizeInterviewCallEvent<T extends EventCandidate>(
  event: T,
): T | SafeCallEvent | null {
  if (event.tags?.["interview.failure"] !== "true") return event;
  const tags = event.tags;
  const app = tags.app;
  const failure = {
    source: tags["interview.source"],
    category: tags["interview.category"],
    phase: tags["interview.phase"],
    state: tags["interview.state"],
  };
  if (
    typeof app !== "string" ||
    !portals.includes(app) ||
    typeof failure.source !== "string" ||
    !sources.includes(failure.source) ||
    typeof failure.category !== "string" ||
    !categories.includes(failure.category) ||
    typeof failure.phase !== "string" ||
    !phases.includes(failure.phase) ||
    typeof failure.state !== "string" ||
    !states.includes(failure.state)
  )
    return null;
  // The runtime checks above bound all values; arbitrary fields never survive.
  const safe = safeEvent(app as Portal, failure as InterviewCallFailure);
  const contexts = event.contexts;
  const candidate =
    contexts && typeof contexts === "object" && "browser" in contexts
      ? contexts.browser
      : null;
  const browser =
    candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : null;
  if (
    typeof browser?.name === "string" &&
    [
      "Chrome",
      "Chrome Mobile",
      "Safari",
      "Mobile Safari",
      "Firefox",
      "Firefox Mobile",
      "Edge",
    ].includes(browser.name)
  ) {
    safe.contexts.browser = {
      name: browser.name,
      ...(typeof browser.version === "string" &&
      /^\d{1,4}(\.\d{1,5}){0,3}$/.test(browser.version)
        ? { version: browser.version }
        : {}),
    };
  }
  return {
    ...safe,
    event_id: event.event_id,
    timestamp: event.timestamp,
    environment: event.environment,
    release: event.release,
  };
}
