"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-dropdown-menu";
import { isTypingTarget, useKeyboardNavigation } from "./keyboard-navigation";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "./command";
import { Search } from "lucide-react";
export type SearchableActionPresentation = { content?: React.ReactNode; destructive?: boolean };
type Entry = SearchableActionPresentation & {
  node: HTMLElement;
  label: string;
  disabled: boolean;
  submenu: boolean;
};
function createMenuStore() {
  const entries = new Map<HTMLElement, Entry>();
  const menus = new Set<HTMLElement>();
  const listeners = new Set<() => void>();
  let version = 0;
  const emit = () => {
    version++;
    listeners.forEach((listener) => listener());
  };
  return {
    entries,
    menus,
    registerMenu(node: HTMLElement) {
      menus.add(node);
      emit();
      return () => {
        menus.delete(node);
        emit();
      };
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => version,
    put(entry: Entry) {
      const old = entries.get(entry.node);
      if (old?.label === entry.label && old.disabled === entry.disabled && old.content === entry.content && old.destructive === entry.destructive) return;
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
/** The same action search for non-menu surfaces such as entity previews. */
export function ActionSearchScope({
  children,
  header,
  alwaysSearchable = false,
  autoFocus = false,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  alwaysSearchable?: boolean;
  autoFocus?: boolean;
}) {
  const [store] = React.useState(createMenuStore);
  return (
    <MenuContext.Provider value={store}>
      <MenuSearchContent searchHeader={header} showSearchTrigger alwaysSearchable={alwaysSearchable} autoFocus={autoFocus}>
        {children}
      </MenuSearchContent>
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
  presentation?: SearchableActionPresentation,
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
      content: presentation?.content,
      destructive: presentation?.destructive ?? element.classList.contains("text-destructive"),
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
/** Submenu portals are separate DOM trees but belong to the same search scope. */
export function useMenuSurface() {
  const store = React.useContext(MenuContext);
  const registered = React.useRef<{
    node: HTMLElement;
    cleanup: () => void;
  } | null>(null);
  return React.useCallback(
    (node: HTMLElement | null) => {
      if (registered.current?.node === node) return;
      registered.current?.cleanup();
      registered.current =
        node && store ? { node, cleanup: store.registerMenu(node) } : null;
    },
    [store],
  );
}
export function useMenuSearchEnabled() {
  return React.useContext(MenuContext) !== null;
}
export function useMenuSearching() {
  return React.useContext(SearchingContext);
}
const emptyStore = createMenuStore();
export function MenuSearchContent({
  children,
  searchHeader,
  showSearchTrigger = false,
  alwaysSearchable = false,
  autoFocus = false,
}: {
  children: React.ReactNode;
  searchHeader?: React.ReactNode;
  showSearchTrigger?: boolean;
  alwaysSearchable?: boolean;
  autoFocus?: boolean;
}) {
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
  const searching = alwaysSearchable || searchOpen;
  const results = [...(store?.entries.values() ?? [])].filter(
    (entry) =>
      (!entry.disabled || (alwaysSearchable && !query.trim())) &&
      entry.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const enabledIndices = results.flatMap((entry, index) => entry.disabled ? [] : [index]);
  const activeIndex = results[active] && !results[active].disabled ? active : (enabledIndices[0] ?? -1);
  React.useLayoutEffect(() => {
    if (searching && (!alwaysSearchable || (autoFocus && !isTypingTarget(document.activeElement)))) input.current?.focus();
  }, [searching, alwaysSearchable, autoFocus]);
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
      const menu = root.current?.closest('[role="menu"]');
      const target = menu?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
        ?? root.current?.querySelector<HTMLButtonElement>('button[aria-label="Search actions"]');
      target?.focus();
    }
  }, [searching]);
  React.useLayoutEffect(() => {
    if (!store) return;
    const menu = root.current?.closest('[role="menu"]') ?? root.current;
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
        if (alwaysSearchable && event.key === "Escape" && !query) return;
        event.stopPropagation();
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const current = enabledIndices.indexOf(activeIndex);
          setActive(enabledIndices.length ? enabledIndices[(current + (event.key === "ArrowDown" ? 1 : -1) + enabledIndices.length) % enabledIndices.length] : 0);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const entry = results[activeIndex];
          if (entry) select(entry);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          restoreMenuFocus.current = !alwaysSearchable;
          setQuery("");
          setSearchOpen(false);
        }
        return;
      }
      if (event.key === ' ' && target instanceof Element && target.closest('button,[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],summary')) return;
      if (event.key.length === 1 && !event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        setActive(0);
        setSearchOpen(true);
        setQuery((value) => value + event.key);
      }
    };
    const menus = new Set([...store.menus, ...(menu ? [menu] : [])]);
    menus.forEach((menu) =>
      menu.addEventListener("keydown", keydown as EventListener, true),
    );
    return () =>
      menus.forEach((menu) =>
        menu.removeEventListener("keydown", keydown as EventListener, true),
      );
  });
  if (!store) return <>{children}</>;
  return (
    <SearchingContext.Provider value={searching}>
      <div
        ref={root}
        className={searching && !showSearchTrigger ? "-m-1" : undefined}
      >
        {!searching && showSearchTrigger && (
          <button
            type="button"
            aria-label="Search actions"
            className="mt-3 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted focus-visible:bg-muted"
            onClick={() => {
              setActive(0);
              setSearchOpen(true);
            }}
          >
            <Search className="size-4" />
            Search actions
          </button>
        )}
        {searching && (
          <Command
            label="Search menu"
            shouldFilter={false}
            disablePointerSelection={false}
            value={String(activeIndex)}
            onValueChange={(value) => setActive(Number(value))}
            className="min-w-56 rounded-lg border-0"
          >
            {searchHeader && <div className="px-3 py-2">{searchHeader}</div>}
            <CommandInput
              ref={input}
              aria-label="Search menu"
              placeholder="Search menu…"
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                setActive(0);
              }}
            />
            <CommandList>
              <CommandGroup>
                {results.map((entry, index) => (
                  <CommandItem
                    key={entry.label + index}
                    value={String(index)}
                    aria-label={entry.label}
                    disabled={entry.disabled}
                    onSelect={() => select(entry)}
                    className={`hover:bg-muted aria-selected:bg-muted dark:hover:bg-muted dark:aria-selected:bg-muted ${entry.destructive ? "text-destructive dark:text-destructive aria-selected:text-destructive dark:aria-selected:text-destructive" : ""}`}
                  >
                    {entry.content ?? entry.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {!results.length && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No matching actions
                </p>
              )}
            </CommandList>
          </Command>
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
