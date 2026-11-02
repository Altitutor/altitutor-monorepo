"use client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@altitutor/ui";
import { MoreVertical, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export type MeetingPerson = {
  id: string;
  label: string;
  receiver?: boolean;
  locked?: boolean;
};
export function MeetingPeopleList({
  title,
  people,
  addControl,
  onRemove,
  onRoleChange,
  receiverLabel = "Receiving",
}: {
  title: string;
  people: MeetingPerson[];
  addControl?: ReactNode;
  onRemove: (id: string) => void;
  onRoleChange?: (id: string, receiver: boolean) => void;
  receiverLabel?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          {title} ({people.length})
        </h3>
        {addControl}
      </div>
      {people.length ? (
        <ul aria-label={title} className="space-y-0.5">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
            >
              <span className="min-w-0 flex-1 break-words text-sm font-medium">
                {person.label}
              </span>
              {onRoleChange && (
                <div className="w-44 shrink-0">
                  <Select
                    value={person.receiver ? "receiver" : "host"}
                    onValueChange={(value) =>
                      onRoleChange(person.id, value === "receiver")
                    }
                  >
                    <SelectTrigger
                      className="h-8"
                      aria-label={`Role for ${person.label}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="host">Conducting</SelectItem>
                      <SelectItem value="receiver">{receiverLabel}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex w-8 shrink-0 justify-end">
                {!person.locked && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${person.label}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onRemove(person.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2 py-2 text-sm text-muted-foreground">
          No people added
        </p>
      )}
    </section>
  );
}
