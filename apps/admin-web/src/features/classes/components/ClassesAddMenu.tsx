"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { Plus } from "lucide-react";
import { AdminPageActionButton } from "@/shared/components";

export function ClassesAddMenu({
  onAddClass,
  onAddAdminShift,
}: {
  onAddClass: () => void;
  onAddAdminShift: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <AdminPageActionButton
          icon={<Plus className="h-4 w-4" />}
          createShortcut
          label="Create"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onAddClass}>Create class</DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddAdminShift}>
          Create admin shift
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
