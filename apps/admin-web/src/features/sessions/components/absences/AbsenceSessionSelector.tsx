"use client";
import type { StudentSession } from "../../types/absence";
import { SessionSelect } from "../SessionSelect";

export function AbsenceSessionSelector({
  sessions,
  selectedSessionIds,
  onToggleSession,
  isLoading = false,
}: {
  sessions: StudentSession[];
  selectedSessionIds: Set<string>;
  onToggleSession: (id: string) => void;
  isLoading?: boolean;
}) {
  return (
    <SessionSelect
      items={sessions}
      value={null}
      onValueChange={() => {}}
      getItemId={(row) => row.id}
      getItemLabel={(row) => row.long_name || row.short_name || "Session"}
      selectedIds={selectedSessionIds}
      onToggle={(row) => onToggleSession(row.id)}
      loading={isLoading}
      placeholder="Select absence sessions"
    />
  );
}
