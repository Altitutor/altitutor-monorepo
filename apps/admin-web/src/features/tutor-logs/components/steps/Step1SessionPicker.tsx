"use client";
import { SessionSelect } from "@/features/sessions/components/SessionSelect";
import { useUnloggedSessionsForStaff } from "../../hooks";

export function Step1SessionPicker({
  title,
  staffId,
  selectedSessionId,
  onSelectSession,
}: {
  title?: string;
  staffId: string;
  selectedSessionId?: string;
  onSelectSession: (id: string) => void;
  variant?: "cards" | "compactList";
}) {
  const { data, isLoading } = useUnloggedSessionsForStaff(staffId);
  const sessions = data?.sessions ?? [];
  return (
    <div className="space-y-4">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <SessionSelect
        items={sessions}
        value={sessions.find((row) => row.id === selectedSessionId) ?? null}
        onValueChange={(row) => {
          if (row) onSelectSession(row.id);
        }}
        getItemId={(row) => row.id}
        getItemLabel={(row) => row.long_name || row.short_name || "Session"}
        loading={isLoading}
        placeholder="Select session to log"
      />
      {!isLoading && !sessions.length && (
        <p className="text-sm text-muted-foreground">
          No sessions available to log.
        </p>
      )}
    </div>
  );
}
