import { notFound } from "next/navigation";
import { SentryTestButton } from "./sentry-test-button";

export const dynamic = "force-dynamic";

export default function SentryExamplePage() {
  const isEnabled =
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "preview";

  if (!isEnabled) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Sentry integration test</h1>
      <p>
        This non-production page throws a browser error to verify the
        student-web Sentry project and source maps.
      </p>
      <SentryTestButton />
    </main>
  );
}
