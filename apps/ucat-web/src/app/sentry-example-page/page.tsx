import { notFound } from "next/navigation";
import { SentryTestButton } from "./sentry-test-button";

export const dynamic = "force-dynamic";

export default function SentryExamplePage() {
  const isEnabled =
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "preview";

  if (!isEnabled) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sentry integration test
        </h1>
        <p className="text-sm text-muted-foreground">
          This non-production page throws a browser error so you can confirm
          that the event and its source map arrive in Sentry.
        </p>
      </div>
      <SentryTestButton />
    </main>
  );
}
