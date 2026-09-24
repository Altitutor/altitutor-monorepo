"use client";

export function SentryTestButton() {
  return (
    <button
      type="button"
      style={{ cursor: "pointer", padding: "10px 16px", width: "fit-content" }}
      onClick={() => {
        throw new Error("Sentry example error from marketing-web");
      }}
    >
      Throw a test error
    </button>
  );
}
