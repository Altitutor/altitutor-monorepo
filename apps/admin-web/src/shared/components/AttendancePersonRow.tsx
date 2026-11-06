"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { AttendanceCell } from "@/features/sessions/components/AttendanceCell";
import { cn } from "@/shared/utils";
import { plannedAttendanceClass, plannedAttendanceTone } from "@/shared/utils/statusTone";

export function AttendancePersonRow({
  href,
  name,
  plannedStatus,
  actualAttended,
}: {
  href: string;
  name: string;
  plannedStatus: string;
  actualAttended?: boolean | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Link
        href={href}
        className={cn(
          "text-xs hover:underline focus-visible:underline",
          plannedAttendanceClass(plannedAttendanceTone(plannedStatus)),
        )}
      >
        {name}
      </Link>
      <AttendanceCell status={plannedStatus as "attending"} compact />
      {actualAttended === true ? (
        <Check role="img" aria-label="Actual: Attended" className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
      ) : actualAttended === false ? (
        <X role="img" aria-label="Actual: Absent" className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
      ) : null}
    </div>
  );
}
