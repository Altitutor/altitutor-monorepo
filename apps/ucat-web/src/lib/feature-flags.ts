function parseBooleanEnv(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return defaultValue;
}

/**
 * Set generator is in feature testing. Enable locally with
 * NEXT_PUBLIC_UCAT_SET_GENERATOR_ENABLED=true in apps/ucat-web/.env.local.
 */
export function isSetGeneratorEnabled(): boolean {
  return parseBooleanEnv(
    process.env.NEXT_PUBLIC_UCAT_SET_GENERATOR_ENABLED,
    false,
  );
}

export function isSetGeneratorPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return (
    normalized === "/set-generator" ||
    normalized === "/sets/set-generator" ||
    normalized.startsWith("/sets/set-generator/")
  );
}
