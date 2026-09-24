"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-AU">
      <body style={bodyStyle}>
        <main>
          <h1 style={{ fontSize: "24px", margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#4b5563", margin: "0 0 20px" }}>
            We&apos;ve been notified. Try loading the site again.
          </p>
          <button type="button" onClick={reset} style={buttonStyle}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

const bodyStyle = {
  alignItems: "center",
  background: "#ffffff",
  color: "#111827",
  display: "flex",
  fontFamily: "system-ui, sans-serif",
  justifyContent: "center",
  margin: 0,
  minHeight: "100vh",
  padding: "24px",
  textAlign: "center" as const,
};

const buttonStyle = {
  background: "#111827",
  border: 0,
  borderRadius: "8px",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 16px",
};
