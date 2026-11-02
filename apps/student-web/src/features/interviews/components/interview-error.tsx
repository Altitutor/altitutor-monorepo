import React from "react";
import { Button } from "@altitutor/ui";

export function InterviewError({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-6"
    >
      <h2 className="font-semibold">Interviews unavailable</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      {retry && (
        <Button variant="outline" className="mt-4" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
