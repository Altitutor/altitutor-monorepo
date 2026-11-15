import { Sentry } from "@/lib/sentry-client";
import { createAndroidSheetDiagnostics } from "./sheet-diagnostics";

// Sentry owns timestamping, bounded breadcrumb retention and native forwarding.
// Existing release/OTA and lifecycle context supplies incident correlation.
export const sheetDiagnostics = createAndroidSheetDiagnostics(
  process.env.EXPO_OS,
  Sentry,
);
