import { notFound } from "next/navigation";
import { SentryTestButton } from "./sentry-test-button";

export const dynamic = "force-dynamic";

export default function SentryExamplePage() {
  const isEnabled =
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "preview";

  if (!isEnabled) notFound();

  return (
    <main style={mainStyle}>
      <h1 style={{ margin: 0 }}>Sentry integration test</h1>
      <p>
        This non-production page throws a browser error to verify the
        marketing-web Sentry project and source maps.
      </p>
      <SentryTestButton />
    </main>
  );
}

const mainStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "16px",
  justifyContent: "center",
  margin: "0 auto",
  maxWidth: "640px",
  minHeight: "100vh",
  padding: "24px",
};
