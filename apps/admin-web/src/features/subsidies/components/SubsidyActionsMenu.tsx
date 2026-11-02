"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { Edit2, MoreVertical, Trash2 } from "lucide-react";

interface SubsidyActionsMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function SubsidyActionsMenu({
  onEdit,
  onDelete,
  disabled,
}: SubsidyActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Subsidy actions"
          disabled={disabled}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Edit2 className="mr-2 h-4 w-4" />
          Edit subsidy
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          className="!text-destructive focus:!text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete subsidy
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
