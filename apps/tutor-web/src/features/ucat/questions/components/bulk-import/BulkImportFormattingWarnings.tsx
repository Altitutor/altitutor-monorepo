"use client";

import { AlertTriangle } from "lucide-react";
import type { BulkImportFormattingIssue } from "@/features/ucat/questions/components/bulk-import/bulkImportFormattingLint";

export function BulkImportFormattingWarnings({
  issues,
}: {
  issues: BulkImportFormattingIssue[];
}) {
  if (issues.length === 0) return null;

  return (
    <div
      role="status"
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Formatting check found {issues.length} issue
        {issues.length === 1 ? "" : "s"}
      </div>
      <ul className="mt-1.5 max-h-28 list-disc space-y-1 overflow-y-auto pl-5">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.location}-${index}`}>
            <span className="font-medium">{issue.location}:</span>{" "}
            {issue.message}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-amber-800 dark:text-amber-200">
        These warnings do not block the import.
      </p>
    </div>
  );
}
