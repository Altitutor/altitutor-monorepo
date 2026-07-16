"use client";

export function SentryTestButton() {
  return (
    <button
      type="button"
      className="w-fit rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
      onClick={() => {
        throw new Error("Sentry example error from admin-web");
      }}
    >
      Throw a test error
    </button>
  );
}
