export function PortalAccessUnavailable() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Temporarily unavailable</h1>
      <p className="text-muted-foreground">
        Student portal services are temporarily unavailable. Please try again.
      </p>
      <a className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href="">
        Try again
      </a>
    </main>
  );
}
