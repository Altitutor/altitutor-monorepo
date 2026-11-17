"use client";
import { useRef } from "react";
import { Button, useSearchableAction } from "@altitutor/ui";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";

function ReferenceActionButton({
  action,
  onActivate,
}: {
  action: RecordMenuAction;
  onActivate?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useSearchableAction(ref, Boolean(action.disabled));
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      disabled={action.disabled}
      className={`h-auto w-full justify-start whitespace-normal py-1.5 text-left hover:bg-muted dark:hover:bg-muted focus-visible:bg-muted ${action.destructive ? "text-destructive hover:text-destructive" : ""}`}
      onClick={() => {
        onActivate?.();
        action.action();
      }}
    >
      <action.icon className="mr-2 size-4 shrink-0" />
      {action.group ? `${action.group} · ` : ""}
      {action.title}
    </Button>
  );
}

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
        <ReferenceActionButton
          key={action.id}
          action={action}
          onActivate={onActivate}
        />
      ))}
    </div>
  );
}
