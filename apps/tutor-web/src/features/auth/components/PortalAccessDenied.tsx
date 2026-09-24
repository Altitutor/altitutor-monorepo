export function PortalAccessDenied() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Access unavailable</h1>
      <p className="text-muted-foreground">
        This tutor account does not currently have access to TutorWeb. Sign out
        and contact Altitutor if you think this is a mistake.
      </p>
    </main>
  );
}
