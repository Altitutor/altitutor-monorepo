"use client";
import { useMemo, useRef } from "react";
import { Button, useSearchableAction } from "@altitutor/ui";
import { ActionEntityChip } from "./ActionEntityChip";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";

function ReferenceActionButton({
  action,
  onActivate,
}: {
  action: RecordMenuAction;
  onActivate?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const content = useMemo(() => <>
    <action.icon className="mr-2 size-4 shrink-0" />
    <span>{action.group ? `${action.group} · ` : ""}{action.renderTitle ?? action.title}</span>
    {action.context && <ActionEntityChip {...action.context} />}
  </>, [action]);
  useSearchableAction(ref, Boolean(action.disabled), false, {content, destructive:action.destructive});
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      disabled={action.disabled}
      aria-label={action.context ? `${action.title} (${action.context.label})` : action.title}
      className={`h-auto w-full justify-start whitespace-normal py-1.5 text-left hover:bg-muted dark:hover:bg-muted focus-visible:bg-muted ${action.destructive ? "text-destructive dark:text-destructive hover:text-destructive dark:hover:text-destructive" : ""}`}
      onClick={() => {
        onActivate?.();
        action.action();
      }}
    >
      {content}
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
