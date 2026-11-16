"use client";
import { Button } from "@altitutor/ui";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";

export function ReferenceActionList({
  actions,
  onActivate,
}: {
  actions: RecordMenuAction[];
  onActivate?: () => void;
}) {
  return (
    <div className="space-y-0.5">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="ghost"
          size="sm"
          disabled={action.disabled}
          className={`h-auto w-full justify-start whitespace-normal py-1.5 text-left ${action.destructive ? "text-destructive hover:text-destructive" : ""}`}
          onClick={() => {
            onActivate?.();
            action.action();
          }}
        >
          <action.icon className="mr-2 size-4 shrink-0" />
          {action.group ? `${action.group} · ` : ""}
          {action.title}
        </Button>
      ))}
    </div>
  );
}
