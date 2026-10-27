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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AdminPageActionButton
          icon={<Plus className="h-4 w-4" />}
          label="Add"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onAddClass}>Add class</DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddAdminShift}>
          Add admin shift
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
