"use client";

/**
 * Last-resort UI when the Server Component cannot read the session even though
 * middleware authenticated the request. Never auto-nav to /signup — that races
 * middleware's incomplete-signup redirect back to /signup/complete.
 */
export function SignupCompleteSessionFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load your signup session. Retry without leaving this
        page.
      </p>
      <button
        type="button"
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        onClick={() => {
          window.location.reload();
        }}
      >
        Retry
      </button>
    </div>
  );
}
