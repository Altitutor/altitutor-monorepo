"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { SearchableSelect } from "./searchable-select";
import {
  CollectionField,
  CollectionPickerContext,
} from "./collection-picker-context";
import {
  isTypingTarget,
  isVisibleShortcutTarget,
  keyboardPane,
  subscribeKeyboardScope,
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
  layout: "list" | "board";
  activate: (id: string) => void;
  toggle: (id: string) => void;
};
const SelectionContext = React.createContext<Selection | null>(null);
export function CollectionRecord({
  id,
  children,
  layout,
}: {
  id: string;
  children: React.ReactNode;
  layout?: "list" | "board";
}) {
  const selection = React.useContext(SelectionContext);
  const contentId = React.useId();
  if (!selection) return <>{children}</>;
  const selected = selection.selected.has(id);
  const board = (layout ?? selection.layout) === "board";
  return (
    <div
      data-keyboard-record={id}
      tabIndex={-1}
      onFocus={() => selection.activate(id)}
      data-selected={selected || undefined}
      onClickCapture={(event) => {
        if (
          !(event.shiftKey || event.metaKey || event.ctrlKey) ||
          (event.target instanceof Element &&
            event.target.closest('button,input,a,[role="combobox"]'))
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        selection.activate(id);
        selection.toggle(id);
      }}
      className={cn(
        "group/collection-record relative flex min-w-0 items-start gap-1 rounded-md outline-none",
        selection.active === id && "ring-1 ring-ring",
        (selected || selection.active === id) &&
          "bg-muted [&_[data-work-item-card]]:bg-muted [&_[data-work-item-row]]:bg-muted",
      )}
    >
      {!board && (
        <button
          type="button"
          aria-label="Select record"
          aria-describedby={contentId}
          aria-pressed={selected}
          className={cn(
            "m-2 mt-3 h-4 w-4 shrink-0 rounded border border-border text-xs transition-opacity group-hover/collection-record:opacity-100 group-focus-within/collection-record:opacity-100 focus-visible:opacity-100",
            selected ? "opacity-100" : "opacity-0",
          )}
          onClick={(event) => {
            event.stopPropagation();
            selection.toggle(id);
          }}
        >
          {selected ? "✓" : ""}
        </button>
      )}
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
  layout = "list",
  renderAction,
}: {
  children: React.ReactNode;
  items: T[];
  getItemId: (item: T) => string;
  actions?: CollectionKeyboardAction<T>[];
  onOpen?: (item: T) => void;
  layout?: "list" | "board";
  renderAction?: (
    action: CollectionKeyboardAction<T>,
    item: T,
  ) => React.ReactNode;
}) {
  const enabled = useKeyboardNavigation();
  const root = React.useRef<HTMLDivElement>(null);
  const toolbar = React.useRef<HTMLDivElement>(null);
  const visibleOwner = React.useSyncExternalStore(
    subscribeKeyboardScope,
    () => {
      const node = root.current;
      if (!node || !isVisibleShortcutTarget(node)) return false;
      const pane = keyboardPane();
      if (
        toolbar.current?.contains(document.activeElement) ||
        toolbar.current?.contains(pane)
      )
        return true;
      if (
        !pane.contains(node) ||
        pane.matches('[role="dialog"],[role="menu"],[role="alertdialog"]')
      )
        return false;
      const focused = document.activeElement?.closest(
        "[data-keyboard-collection]",
      );
      return focused
        ? focused === node
        : pane.querySelector("[data-keyboard-collection]") === node;
    },
    () => false,
  );
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => setHost(document.body), []);
  const [active, setActive] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [fallback, setFallback] = React.useState<string | null>(null);
  const openRequest = React.useRef<CollectionKeyboardAction<T> | null>(null);
  const [requestVersion, requestOpen] = React.useReducer(
    (value: number) => value + 1,
    0,
  );
  const pending = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ids = new Set(items.map(getItemId));
  const liveSelected = [...selected].filter((id) => ids.has(id));
  const targetIds = liveSelected.length
    ? liveSelected
    : fallback && ids.has(fallback)
      ? [fallback]
      : [];
  const targetItem = items.find((item) => targetIds.includes(getItemId(item)));
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const nativeTrigger = (scope: ParentNode | null, key: string) =>
    [
      ...(scope?.querySelectorAll<HTMLButtonElement>(
        `[data-collection-field="${key}"] button`,
      ) ?? []),
    ].find((button) => !button.disabled && isVisibleShortcutTarget(button));
  const openPicker = (
    action: CollectionKeyboardAction<T>,
    current: string | null,
  ) => {
    if (!liveSelected.length && current) {
      const row = [
        ...(root.current?.querySelectorAll<HTMLElement>(
          "[data-keyboard-record]",
        ) ?? []),
      ].find((row) => row.dataset.keyboardRecord === current);
      const trigger = nativeTrigger(row ?? null, action.key);
      if (trigger) {
        trigger.click();
        return;
      }
      setFallback(current);
    } else if (!liveSelected.length) return;
    setError(null);
    openRequest.current = action;
    requestOpen();
  };
  React.useLayoutEffect(() => {
    const action = openRequest.current;
    if (!action) return;
    const trigger = nativeTrigger(toolbar.current, action.key);
    if (trigger) {
      openRequest.current = null;
      trigger.click();
    }
  }, [requestVersion, targetItem, host]);
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
      const focusId = document.activeElement?.closest<HTMLElement>(
        "[data-keyboard-record]",
      )?.dataset.keyboardRecord;
      const current = focusId ?? active;
      const index = records.findIndex(
        (row) => row.dataset.keyboardRecord === current,
      );
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
        event.stopPropagation();
        const id = next.dataset.keyboardRecord!;
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
        event.stopPropagation();
        toggle(current);
      } else if (!event.shiftKey && key === "enter" && current) {
        if (
          event.target !==
          records.find((row) => row.dataset.keyboardRecord === current)
        )
          return;
        const item = items.find((item) => getItemId(item) === current);
        if (item && onOpen) {
          event.preventDefault();
          event.stopPropagation();
          onOpen(item);
        }
      } else if (key === "escape") {
        setSelected(new Set());
        setFallback(null);
      } else if (!event.shiftKey) {
        if (
          key === " " &&
          event.target instanceof Element &&
          event.target.closest("button,a,summary")
        )
          return;
        const action = actions.find(
          (action) => action.key === (key === " " ? "s" : key),
        );
        if (action && (current || liveSelected.length)) {
          event.preventDefault();
          event.stopPropagation();
          openPicker(action, current ?? null);
        }
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  });
  const apply = async (
    action: CollectionKeyboardAction<T>,
    id: string | null,
  ) => {
    if (pending.current) return false;
    const option = action.options.find((option) =>
      id === null ? option.value === null : String(option.value) === id,
    );
    if (!option) {
      setError("This option is no longer available.");
      return false;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    const work = items.filter((item) => targetIds.includes(getItemId(item)));
    const results = await Promise.allSettled(
      work.map((item) =>
        Promise.resolve().then(() => action.apply(item, option.value)),
      ),
    );
    const failed = work
      .filter((_, index) => results[index].status === "rejected")
      .map(getItemId);
    pending.current = false;
    setBusy(false);
    if (failed.length) {
      setSelected(new Set(failed));
      setError(
        `${failed.length} record(s) could not be updated. Successful changes were saved. Retry the remaining records.`,
      );
      return false;
    }
    setSelected(new Set());
    setFallback(null);
    requestAnimationFrame(() => {
      const records = [
        ...(root.current?.querySelectorAll<HTMLElement>(
          "[data-keyboard-record]",
        ) ?? []),
      ];
      (
        records.find((row) => row.dataset.keyboardRecord === active) ??
        records[0]
      )?.focus();
    });
    return true;
  };
  if (!enabled || !actions?.length) return <>{children}</>;
  return (
    <SelectionContext.Provider
      value={{
        active,
        selected: new Set(liveSelected),
        layout,
        activate: setActive,
        toggle,
      }}
    >
      <div
        ref={root}
        data-keyboard-collection
        className="flex h-full min-h-0 flex-col"
      >
        <div className="min-h-0 flex-1">{children}</div>
      </div>
      {host &&
        targetItem &&
        visibleOwner &&
        createPortal(
          <div
            ref={toolbar}
            data-collection-selection-toolbar
            role="toolbar"
            aria-label="Selected records"
            className="fixed bottom-6 left-1/2 z-[140] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
          >
            <span className="text-sm" aria-live="polite">
              {targetIds.length} {liveSelected.length ? "selected" : "record"}
            </span>
            {actions.map((action) => (
              <CollectionPickerContext.Provider
                key={action.key}
                value={{
                  field: action.key === "p" ? "priority" : action.key,
                  select: (id) => apply(action, id),
                  busy,
                  error,
                  container: () => toolbar.current,
                }}
              >
                <CollectionField field={action.key}>
                  {renderAction?.(action, targetItem) ?? (
                    <SearchableSelect
                      items={action.options}
                      value={null}
                      getItemId={(option) => String(option.value)}
                      getItemLabel={(option) => option.label}
                      onValueChange={() => {}}
                      searchPlaceholder="Search options…"
                      trigger={
                        <Button size="sm" variant="outline">
                          {action.label}
                        </Button>
                      }
                    />
                  )}
                </CollectionField>
              </CollectionPickerContext.Provider>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelected(new Set());
                setFallback(null);
              }}
            >
              Clear selection
            </Button>
          </div>,
          host,
        )}
    </SelectionContext.Provider>
  );
}
