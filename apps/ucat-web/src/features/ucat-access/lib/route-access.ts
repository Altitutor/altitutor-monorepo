import type { UcatAccessFlags } from "@/features/ucat-access/hooks/use-ucat-access";

export type RequiredUcatAccess = "online" | "inPerson";

type UpsellConfig = {
  requiredAccess: RequiredUcatAccess;
  badgeLabel: string;
};

const ONLINE_PREFIXES = [
  "/learn",
  "/practice",
  "/skill-trainer",
  "/sets",
  "/mocks",
];
const IN_PERSON_PREFIXES = ["/sessions"];

function normalizePath(path: string): string {
  return path.replace(/\/$/, "") || "/";
}

export function getUpsellConfigForPath(path: string): UpsellConfig | null {
  const normalized = normalizePath(path);

  if (
    ONLINE_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )
  ) {
    return { requiredAccess: "online", badgeLabel: "Online" };
  }

  if (
    IN_PERSON_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )
  ) {
    return { requiredAccess: "inPerson", badgeLabel: "In-person" };
  }

  return null;
}

export function hasAccessForPath(
  path: string,
  access: UcatAccessFlags,
): boolean {
  const config = getUpsellConfigForPath(path);
  if (!config) return true;

  if (config.requiredAccess === "online") return access.hasOnlineAccess;
  return access.hasInPersonAccess;
}

export function isBlockedPath(path: string, access: UcatAccessFlags): boolean {
  return !access.isLoading && !hasAccessForPath(path, access);
}
