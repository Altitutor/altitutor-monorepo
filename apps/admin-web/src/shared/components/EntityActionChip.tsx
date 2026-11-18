"use client";

import type { ComponentProps } from "react";
import {
  EntityChip,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
} from "@altitutor/ui";
import { toast } from "sonner";
import { cn } from "@/shared/utils";
import { Copy, ExternalLink, MoreVertical } from "lucide-react";
import type { RecordMenuAction } from "./recordMenuActions";
import { useChipHoverActions } from "@/features/entity-references/components/chipHoverActions";

/** Chips navigate directly; explicit calendar action buttons retain their menu. */
export function EntityActionChip({
  onClick,
  iconOnly = false,
  hoverActions,
  ...props
}: ComponentProps<typeof EntityChip> & { iconOnly?: boolean; hoverActions?: RecordMenuAction[] }) {
  const hoverActionsKey = useChipHoverActions(hoverActions);
  props = {
    ...props,
    className: cn(
      props.className,
      props.entityType === "message" && "max-w-40",
    ),
  };
  if (!iconOnly || !props.entityId || !onClick)
    return <EntityChip {...props} onClick={onClick} data-hover-actions-key={hoverActionsKey} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label={`${props.entityType} actions`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        ) : (
          <EntityChip {...props} onClick={(event) => event.stopPropagation()} />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem asChild>
          <button type="button" onClick={onClick}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open {props.entityType.replaceAll("-", " ")}
          </button>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard
              .writeText(
                `@[${props.entityType}:${props.entityId}:${props.label.replace(/\]/g, "")}]`,
              )
              .then(() => toast.success("Copied ID"))
              .catch(() => toast.error("Could not copy ID"));
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy ID
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
