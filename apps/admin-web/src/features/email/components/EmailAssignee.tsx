"use client";
import { Button, SearchableSelect } from "@altitutor/ui";
import { UserRound } from "lucide-react";
import { useEmailCommand } from "../api/client";
import type { MailboxData } from "../types";
export function EmailAssignee({
  threadId,
  value,
  staff,
  pill = false,
}: {
  threadId: string;
  value: string | null;
  staff: MailboxData["staff"];
  pill?: boolean;
}) {
  const command = useEmailCommand();
  const selected = staff.find((person) => person.id === value) ?? null;
  const label = (person: MailboxData["staff"][number]) =>
    [person.first_name, person.last_name].filter(Boolean).join(" ");
  return (
    <div>
      <SearchableSelect
        items={staff}
        value={selected}
        onValueChange={(person) =>
          command.mutate({
            action: "assign",
            threadId,
            staffId: person?.id ?? null,
          })
        }
        getItemId={(person) => person.id}
        getItemLabel={label}
        allowClear
        clearLabel="Unassigned"
        disabled={command.isPending}
        searchPlaceholder="Search active adminstaff…"
        trigger={
          <Button
            variant={pill ? "outline" : "ghost"}
            size="sm"
            className={
              pill
                ? "h-8 rounded-full px-3 text-xs"
                : "h-7 max-w-full justify-start px-2 text-xs"
            }
            aria-label="Assign email conversation"
          >
            <UserRound className="mr-1.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selected
                ? label(selected)
                : value
                  ? "Assigned staff"
                  : "Unassigned"}
            </span>
          </Button>
        }
      />
      {command.error && (
        <p role="alert" className="text-xs text-destructive">
          {command.error.message}
        </p>
      )}
    </div>
  );
}
