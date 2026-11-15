"use client";
import * as React from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { Input } from "./input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { KeyboardShortcut } from "./keyboard-shortcut";
import {
  isTypingTarget,
  isVisibleShortcutTarget,
  keyboardPane,
  useKeyboardNavigation,
} from "./keyboard-navigation";
export interface CollectionKeyboardAction<T> {
  key: "s" | "p" | "a";
  label: string;
  options: { value: string | number | null; label: string }[];
  apply: (item: T, value: string | number | null) => Promise<unknown>;
}
type Selection = {
  active: string | null;
  selected: ReadonlySet<string>;
  activate: (id: string) => void;
  toggle: (id: string) => void;
};
const SelectionContext = React.createContext<Selection | null>(null);
export function CollectionRecord({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const selection = React.useContext(SelectionContext);
  const contentId = React.useId();
  if (!selection) return <>{children}</>;
  return (
    <div
      data-keyboard-record={id}
      tabIndex={-1}
      onFocus={() => selection.activate(id)}
      data-selected={selection.selected.has(id) || undefined}
      className={cn(
        "relative flex min-w-0 items-start gap-1 rounded-md outline-none",
        selection.active === id && "ring-1 ring-ring",
        selection.selected.has(id) && "bg-accent",
      )}
    >
      <button
        type="button"
        aria-label="Select record"
        aria-describedby={contentId}
        aria-pressed={selection.selected.has(id)}
        className="m-2 mt-3 h-4 w-4 shrink-0 rounded border border-border text-xs"
        onClick={(event) => {
          event.stopPropagation();
          selection.toggle(id);
        }}
      >
        {selection.selected.has(id) ? "✓" : ""}
      </button>
      <div id={contentId} className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}
export function KeyboardCollection<T>({
  children,
  items,
  getItemId,
  actions,
  onOpen,
}: {
  children: React.ReactNode;
  items: T[];
  getItemId: (item: T) => string;
  actions?: CollectionKeyboardAction<T>[];
  onOpen?: (item: T) => void;
}) {
  const enabled = useKeyboardNavigation();
  const root = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [picker, setPicker] =
    React.useState<CollectionKeyboardAction<T> | null>(null);
  const [targets, setTargets] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");
  const pending = React.useRef(false);
  const [optionIndex, setOptionIndex] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ids = new Set(items.map(getItemId));
  const liveSelected = [...selected].filter((id) => ids.has(id));
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openPicker = (action: CollectionKeyboardAction<T>, ids: string[]) => {
    if (!ids.length) return;
    setTargets(ids);
    setQuery("");
    setOptionIndex(0);
    setError(null);
    setPicker(action);
  };
  React.useEffect(() => {
    if (!enabled || !actions?.length) return;
    const keydown = (event: KeyboardEvent) => {
      const node = root.current;
      if (
        !node ||
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        isTypingTarget(event.target)
      )
        return;
      const pane = keyboardPane();
      if (
        pane.matches('[role="dialog"],[role="menu"],[role="alertdialog"]') ||
        !pane.contains(node) ||
        !isVisibleShortcutTarget(node)
      )
        return;
      const focused = document.activeElement?.closest(
        "[data-keyboard-collection]",
      );
      if (
        focused
          ? focused !== node
          : pane.querySelector("[data-keyboard-collection]") !== node
      )
        return;
      const records = [
        ...node.querySelectorAll<HTMLElement>("[data-keyboard-record]"),
      ].filter(isVisibleShortcutTarget);
      const recordId = (row: HTMLElement) => row.dataset.keyboardRecord!;
      const focusId = document.activeElement?.closest<HTMLElement>(
        "[data-keyboard-record]",
      )?.dataset.keyboardRecord;
      const current = focusId ?? active;
      const index = records.findIndex((row) => recordId(row) === current);
      const key = event.key.toLowerCase();
      if (key === "j" || key === "k") {
        const next =
          records[
            Math.max(
              0,
              Math.min(
                records.length - 1,
                index < 0
                  ? key === "j"
                    ? 0
                    : records.length - 1
                  : index + (key === "j" ? 1 : -1),
              ),
            )
          ];
        if (!next) return;
        event.preventDefault();
        const id = recordId(next);
        setActive(id);
        next.focus();
        next.scrollIntoView?.({ block: "nearest" });
        if (event.shiftKey)
          setSelected(
            (previous) =>
              new Set([...previous, ...(current ? [current] : []), id]),
          );
      } else if (!event.shiftKey && key === "x" && current) {
        event.preventDefault();
        toggle(current);
      } else if (!event.shiftKey && key === "enter" && current) {
        // Nested controls retain native Enter activation (selection, menus, links).
        if (event.target !== records.find((row) => recordId(row) === current))
          return;
        const item = items.find((item) => getItemId(item) === current);
        if (item && onOpen) {
          event.preventDefault();
          event.stopPropagation();
          onOpen(item);
        }
      } else if (key === "escape") {
        setSelected(new Set());
      } else if (!event.shiftKey) {
        const action = actions.find((action) => action.key === key);
        if (action) {
          event.preventDefault();
          openPicker(
            action,
            liveSelected.length ? liveSelected : current ? [current] : [],
          );
        }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });
  const apply = async (value: string | number | null) => {
    if (!picker || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const work = items.filter((item) => targets.includes(getItemId(item)));
    const results = await Promise.allSettled(
      work.map((item) =>
        Promise.resolve().then(() => picker.apply(item, value)),
      ),
    );
    const failed = work
      .filter((_, index) => results[index].status === "rejected")
      .map(getItemId);
    pending.current = false;
    setBusy(false);
    if (failed.length) {
      setTargets(failed);
      setSelected(new Set(failed));
      setError(
        `${failed.length} record(s) could not be updated. Successful changes were saved. Retry the remaining records.`,
      );
    } else {
      setPicker(null);
      setSelected(new Set());
      root.current
        ?.querySelector<HTMLElement>("[data-keyboard-record]")
        ?.focus();
    }
  };
  const matchingOptions =
    picker?.options.filter((option) =>
      option.label.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  if (!enabled || !actions?.length) return <>{children}</>;
  return (
    <SelectionContext.Provider
      value={{
        active,
        selected: new Set(liveSelected),
        activate: setActive,
        toggle,
      }}
    >
      <div
        ref={root}
        data-keyboard-collection
        className="flex h-full min-h-0 flex-col"
      >
        {!!liveSelected.length && (
          <div
            className="flex flex-wrap items-center gap-2 border-b px-4 py-2"
            aria-live="polite"
          >
            <span className="text-sm">{liveSelected.length} selected</span>
            {actions.map((action) => (
              <Button
                key={action.key}
                size="sm"
                variant="outline"
                onClick={() => openPicker(action, liveSelected)}
              >
                {action.label}
                <KeyboardShortcut
                  keys={[action.key.toUpperCase()]}
                  className="ml-2"
                />
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear selection
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1">{children}</div>
        <Dialog
          open={!!picker}
          onOpenChange={(open) => {
            if (!open && !busy) setPicker(null);
          }}
        >
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {picker?.label} · {targets.length} record
                {targets.length === 1 ? "" : "s"}
              </DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              placeholder="Search options…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOptionIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setOptionIndex((index) =>
                    matchingOptions.length
                      ? (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          matchingOptions.length) %
                        matchingOptions.length
                      : 0,
                  );
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const option = matchingOptions[optionIndex];
                  if (option) void apply(option.value);
                }
              }}
              disabled={busy}
            />
            <div className="max-h-72 overflow-auto">
              {matchingOptions.map((option, index) => (
                <Button
                  key={String(option.value)}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    index === optionIndex && "bg-accent",
                  )}
                  disabled={busy}
                  onClick={() => void apply(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SelectionContext.Provider>
  );
}
