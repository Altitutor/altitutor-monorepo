"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-dropdown-menu";
import { useKeyboardNavigation } from "./keyboard-navigation";
import { Input } from "./input";
type Entry = {
  node: HTMLElement;
  label: string;
  disabled: boolean;
  submenu: boolean;
};
function createMenuStore() {
  const entries = new Map<HTMLElement, Entry>();
  const listeners = new Set<() => void>();
  let version = 0;
  const emit = () => {
    version++;
    listeners.forEach((listener) => listener());
  };
  return {
    entries,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => version,
    put(entry: Entry) {
      const old = entries.get(entry.node);
      if (old?.label === entry.label && old.disabled === entry.disabled) return;
      entries.set(entry.node, entry);
      emit();
    },
    remove(node: HTMLElement) {
      if (entries.delete(node)) emit();
    },
  };
}
const MenuContext = React.createContext<ReturnType<
  typeof createMenuStore
> | null>(null);
const PathContext = React.createContext({ path: "", disabled: false });
const SubOpenContext = React.createContext(false);
export function useMenuSubOpen() {
  return React.useContext(SubOpenContext);
}
const SearchingContext = React.createContext(false);
const SubLabelContext = React.createContext<
  ((label: string, disabled: boolean) => void) | null
>(null);
export function MenuSearchRoot(
  props: React.ComponentProps<typeof Primitive.Root>,
) {
  const enabled = useKeyboardNavigation();
  const [store] = React.useState(createMenuStore);
  return (
    <MenuContext.Provider value={enabled ? store : null}>
      <Primitive.Root {...props} />
    </MenuContext.Provider>
  );
}
export function MenuSearchSub({
  children,
  open,
}: {
  children: React.ReactNode;
  open: boolean;
}) {
  const parent = React.useContext(PathContext);
  const [label, setLabel] = React.useState("");
  const [disabled, setDisabled] = React.useState(false);
  const update = React.useCallback((label: string, disabled: boolean) => {
    setLabel(label);
    setDisabled(disabled);
  }, []);
  return (
    <SubOpenContext.Provider value={open}>
      <PathContext.Provider
        value={{
          path: [parent.path, label].filter(Boolean).join(" → "),
          disabled: parent.disabled || disabled,
        }}
      >
        <SubLabelContext.Provider value={update}>
          {children}
        </SubLabelContext.Provider>
      </PathContext.Provider>
    </SubOpenContext.Provider>
  );
}
export function useSubLabel(
  node: React.RefObject<HTMLElement | null>,
  disabled: boolean,
) {
  const update = React.useContext(SubLabelContext);
  React.useLayoutEffect(() => {
    if (node.current)
      update?.(node.current.textContent?.trim() ?? "", disabled);
  });
}
export function useMenuEntry(
  node: React.RefObject<HTMLElement | null>,
  disabled: boolean,
  submenu = false,
) {
  const store = React.useContext(MenuContext);
  const parent = React.useContext(PathContext);
  React.useLayoutEffect(() => {
    const element = node.current;
    if (!store || !element) return;
    const clone = element.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll("[data-menu-shortcut]")
      .forEach((node) => node.remove());
    const label =
      element.getAttribute("aria-label") ?? clone.textContent?.trim() ?? "";
    store.put({
      node: element,
      label: submenu
        ? parent.path || label
        : [parent.path, label].filter(Boolean).join(" → "),
      submenu,
      disabled: parent.disabled || disabled,
    });
  });
  React.useLayoutEffect(() => {
    const element = node.current;
    return () => {
      if (element) store?.remove(element);
    };
  }, [store, node]);
}
export function useMenuSearchEnabled() {
  return React.useContext(MenuContext) !== null;
}
export function useMenuSearching() {
  return React.useContext(SearchingContext);
}
const emptyStore = createMenuStore();
export function MenuSearchContent({ children }: { children: React.ReactNode }) {
  const store = React.useContext(MenuContext);
  React.useSyncExternalStore(
    store?.subscribe ?? emptyStore.subscribe,
    store?.snapshot ?? emptyStore.snapshot,
    emptyStore.snapshot,
  );
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const restoreMenuFocus = React.useRef(false);
  const [active, setActive] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);
  const searching = searchOpen;
  const results = [...(store?.entries.values() ?? [])].filter(
    (entry) =>
      !entry.disabled &&
      entry.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  React.useLayoutEffect(() => {
    if (searching) input.current?.focus();
  }, [searching]);
  const root = React.useRef<HTMLDivElement>(null);
  const pendingSubmenu = React.useRef<HTMLElement | null>(null);
  const select = (entry: Entry) => {
    if (entry.disabled || !entry.node.isConnected) return;
    if (entry.submenu) {
      pendingSubmenu.current = entry.node;
      setQuery("");
      setSearchOpen(false);
    } else entry.node.click();
  };
  React.useLayoutEffect(() => {
    if (!searching && pendingSubmenu.current) {
      const trigger = pendingSubmenu.current;
      pendingSubmenu.current = null;
      trigger.click();
    } else if (!searching && restoreMenuFocus.current) {
      restoreMenuFocus.current = false;
      root.current
        ?.closest('[role="menu"]')
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
        ?.focus();
    }
  }, [searching]);
  React.useLayoutEffect(() => {
    if (!store) return;
    const menu = root.current?.closest('[role="menu"]');
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input,textarea,[contenteditable], [role="combobox"]') &&
        target !== input.current
      )
        return;
      if (target === input.current) {
        event.stopPropagation();
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setActive((index) =>
            results.length
              ? (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  results.length) %
                results.length
              : 0,
          );
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const entry = results[Math.min(active, results.length - 1)];
          if (entry) select(entry);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          restoreMenuFocus.current = true;
          setQuery("");
          setSearchOpen(false);
        }
        return;
      }
      if (event.key.length === 1 && !event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        setActive(0);
        setSearchOpen(true);
        setQuery((value) => value + event.key);
      }
    };
    menu?.addEventListener("keydown", keydown as EventListener, true);
    return () =>
      menu?.removeEventListener("keydown", keydown as EventListener, true);
  });
  if (!store) return <>{children}</>;
  return (
    <SearchingContext.Provider value={searching}>
      <div ref={root}>
        {searching && (
          <>
            <div className="p-1">
              <Input
                ref={input}
                aria-label="Search menu"
                placeholder="Search menu…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
              />
            </div>
            <div role="group" className="max-h-72 min-w-56 overflow-auto">
              {results.map((entry, index) => (
                <button
                  key={entry.label + index}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={`flex w-full rounded-sm px-2 py-1.5 text-left text-sm ${index === active ? "bg-accent text-accent-foreground" : ""}`}
                  onPointerMove={() => setActive(index)}
                  onClick={() => select(entry)}
                >
                  {entry.label}
                </button>
              ))}
              {!results.length && (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  No matching actions
                </p>
              )}
            </div>
          </>
        )}
        <div hidden={searching}>{children}</div>
      </div>
    </SearchingContext.Provider>
  );
}
export function assignMenuRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
