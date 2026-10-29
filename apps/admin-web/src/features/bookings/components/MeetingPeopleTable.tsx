"use client";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
export function MeetingPeopleTable({
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {onRoleChange && <TableHead>Role</TableHead>}
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person) => (
            <TableRow key={person.id}>
              <TableCell>{person.label}</TableCell>
              {onRoleChange && (
                <TableCell>
                  <Select
                    value={person.receiver ? "receiver" : "host"}
                    onValueChange={(value) =>
                      onRoleChange(person.id, value === "receiver")
                    }
                  >
                    <SelectTrigger aria-label={`Role for ${person.label}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="host">Conducting</SelectItem>
                      <SelectItem value="receiver">{receiverLabel}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              )}
              <TableCell>
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
              </TableCell>
            </TableRow>
          ))}
          {!people.length && (
            <TableRow>
              <TableCell
                colSpan={onRoleChange ? 3 : 2}
                className="text-muted-foreground"
              >
                No people added
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
