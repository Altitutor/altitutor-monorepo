"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  KeyboardShortcut,
} from "@altitutor/ui";
import { pageShortcuts } from "./registry";
const actions: [string[], string][] = [
  [["C"], "Create in the current page or pane"],
  [["Option", "N"], "Create (alias)"],
  [["Option", "F"], "Search in the current pane"],
  [["F"], "Add filter"],
  [["S"], "Change status"],
  [["D"], "Due date"],
  [["E"], "Task estimate"],
  [["M"], "Open menu in the current page or pane"],
  [["G", "Shift", "letter"], "Open the destination in a new pane"],
  [["P"], "Change priority"],
  [["A"], "Assign task, email or message / Project lead"],
  [["J"], "Next record"],
  [["K"], "Previous record"],
  [["Enter"], "Open record"],
  [["X"], "Toggle record selection"],
  [["Shift", "J / K"], "Extend selection"],
  [["1 – 9"], "Apply view in displayed order"],
  [["["], "Toggle left sidebar"],
  [["Option", "W"], "Close the active pane"],
  [["R"], "Reply to email"],
  [["Shift", "R"], "Reply all"],
  [["Shift", "F"], "Forward email"],
  [["V"], "Move email to folder"],
  [["U"], "Mark email/message read or unread"],
  [["Option", "K"], "Command palette (also Command / Ctrl + K)"],
  [["?"], "Keyboard shortcuts"],
];
export function ShortcutHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const rows: [readonly string[], string][] = [
    ...actions,
    ...pageShortcuts.map(
      ([key, , label]) =>
        [["G", key.toUpperCase()], `Go to ${label}`] as [string[], string],
    ),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85dvh] overflow-auto sm:max-w-lg"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search keyboard shortcuts…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          Keys act in the focused pane. Single letters leave typing alone.
          Actions appear only where supported.
        </p>
        <div className="space-y-2">
          {rows
            .filter(([keys, label]) =>
              `${label} ${keys.join(" ")}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map(([keys, label]) => (
              <div
                className="flex items-center justify-between gap-4 text-sm"
                key={label}
              >
                <span>{label}</span>
                <KeyboardShortcut keys={keys} aria-hidden={false} />
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
