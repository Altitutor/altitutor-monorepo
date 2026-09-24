"use client";

import { Button } from "@/components/ui/button";

export function SentryTestButton() {
  return (
    <Button
      type="button"
      onClick={() => {
        throw new Error("Sentry example error from ucat-web");
      }}
    >
      Throw a test error
    </Button>
  );
}
