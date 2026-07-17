import type { UcatQuotaArea } from "@/features/ucat-access/types/quota";

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0] ?? pathname;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

/** Active practice engine routes (question stem / session). */
export function isPracticeEngineRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === "/practice/session" || path.startsWith("/practice/stem/");
}

/** Active set attempt in the UCAT question engine. */
export function isSetEngineRoute(pathname: string): boolean {
  return normalizePathname(pathname) === "/exam/sets";
}

/** Active mock attempt in the UCAT question engine. */
export function isMockEngineRoute(pathname: string): boolean {
  return normalizePathname(pathname) === "/exam/mocks";
}

/** Active skill trainer attempt. */
export function isSkillTrainerPlayRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return /\/skill-trainer\/[^/]+\/play$/.test(path);
}

function matchesPracticeRoutes(path: string): boolean {
  return (
    path === "/practice" ||
    path.startsWith("/practice/") ||
    path.startsWith("/progress/practice-sessions/")
  );
}

function matchesSetsBrowsingRoutes(path: string): boolean {
  if (isSetEngineRoute(path)) return false;
  if (path === "/sets" || path.startsWith("/sets/")) return true;
  if (path.startsWith("/progress/set-attempts/")) return true;
  if (/^\/progress\/sections\/\d+\/set-attempts\//.test(path)) return true;
  if (/^\/sessions\/[^/]+\/sets\//.test(path)) return true;
  return false;
}

function matchesMocksBrowsingRoutes(path: string): boolean {
  if (isMockEngineRoute(path)) return false;
  if (path === "/mocks" || path.startsWith("/mocks/")) return true;
  if (path === "/progress/mocks" || path.startsWith("/progress/mocks/")) return true;
  if (path.startsWith("/progress/mock-attempts/")) return true;
  if (/^\/sessions\/[^/]+\/mocks\//.test(path)) return true;
  return false;
}

function matchesLearnBrowsingRoutes(path: string): boolean {
  return path === "/learn" || path.startsWith("/learn/");
}

function matchesSkillTrainerBrowsingRoutes(path: string): boolean {
  if (isSkillTrainerPlayRoute(path)) return false;
  return path === "/skill-trainer" || path.startsWith("/skill-trainer/");
}

/**
 * Maps the current app route to the UCAT Free quota area shown in the header pill.
 * Covers feature subpages, related progress/session routes, and the live practice
 * engine so free-plan students can see remaining practice questions while answering.
 * Active set/mock/skill-trainer engines stay excluded (those use attempt pills).
 */
export function getQuotaAreaForPathname(pathname: string): UcatQuotaArea | null {
  const path = normalizePathname(pathname);

  if (matchesPracticeRoutes(path)) return "practice";
  if (matchesSetsBrowsingRoutes(path)) return "sets";
  if (matchesMocksBrowsingRoutes(path)) return "mocks";
  if (matchesLearnBrowsingRoutes(path)) return "learn";
  if (matchesSkillTrainerBrowsingRoutes(path)) return "skill_trainer";

  return null;
}
