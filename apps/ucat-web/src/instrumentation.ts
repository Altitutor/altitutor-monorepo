import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next.js 15+ calls this hook for nested Server Component and route errors.
// Keeping it here is forward-compatible; Next.js 14 uses Sentry's webpack wrapping.
export const onRequestError = Sentry.captureRequestError;
