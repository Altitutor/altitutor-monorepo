/**
 * Lightweight route transition UI — keeps chrome visible; only the segment
 * that suspends shows this (see `app/(student)/loading.tsx`).
 */
export function StudentRouteLoading() {
  return (
    <div className="w-full" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading page</span>
      <div
        className="relative h-0.5 w-full overflow-hidden rounded-full bg-muted/70 dark:bg-muted/40"
        aria-hidden
      >
        <div className="absolute inset-y-0 left-0 w-[min(32%,12rem)] rounded-full bg-primary/85 motion-safe:animate-app-route-loading-bar motion-reduce:animate-none dark:bg-brand-lightBlue/90" />
      </div>
    </div>
  );
}
