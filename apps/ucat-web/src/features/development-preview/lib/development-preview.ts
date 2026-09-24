import { notFound } from "next/navigation";

export function isDevelopmentPreviewEnvironment(
  environment: string | undefined = process.env.NODE_ENV,
): boolean {
  return environment === "development";
}

export function requireDevelopmentPreview(): void {
  if (!isDevelopmentPreviewEnvironment()) notFound();
}
