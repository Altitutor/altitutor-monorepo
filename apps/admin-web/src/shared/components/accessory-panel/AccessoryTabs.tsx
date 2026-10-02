"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { navLinkActiveStyles, navLinkInactiveStyles } from "@/shared/utils";
import { List, Columns, X } from "lucide-react";
import {
  useAccessoryPanel,
  type AccessoryTab,
  type AccessoryDestination,
  accessoryFamily,
} from "@/shared/contexts/AccessoryPanelContext";
import { AccessoryTabContext } from "@/shared/contexts/AccessoryTabContext";
import { ResponsivePane } from "@/shared/hooks/usePanelMediaQuery";
import { AccessoryView } from "./AccessoryViews";
import { Button } from "@altitutor/ui";
import { AccessoryIcon } from "./AccessoryIcon";
import { AccessoryTabPicker } from "./AccessoryTabPicker";

type CloseGate = (next?: () => void) => void;
function TabContent({
  tab,
  active,
  registerGate,
  gates,
}: {
  tab: AccessoryTab;
  active: boolean;
  registerGate: (key: string, gate: CloseGate | null) => void;
  gates: React.MutableRefObject<Map<string, CloseGate>>;
}) {
  const panel = useAccessoryPanel();
  const closeTab = panel?.closeTab;
  const close = useCallback(() => closeTab?.(tab.key), [closeTab, tab.key]);
  const registerClose = useCallback(
    (gate: CloseGate | null) => registerGate(tab.key, gate),
    [registerGate, tab.key],
  );
  const openTab = panel?.openTab;
  const navigateTab = panel?.navigateTab;
  const updateQuery = panel?.updateQuery;
  const navigate = useCallback(
    (target: AccessoryDestination) => {
      if (accessoryFamily(target.kind) !== accessoryFamily(tab.kind)) {
        const owned =
          (tab.kind === "project" &&
            ["task", "document"].includes(target.kind)) ||
          (tab.kind === "issue" && target.kind === "task");
        openTab?.(
          owned && tab.id
            ? {
                ...target,
                owner: { kind: tab.kind, id: tab.id, title: tab.title },
              }
            : target,
        );
        return;
      }
      if (target.kind === tab.kind && target.id === tab.id) {
        if (target.query !== undefined) updateQuery?.(tab.key, target.query);
        return;
      }
      const next = () => navigateTab?.(tab.key, target);
      const gate = gates.current.get(tab.key);
      if (gate) gate(next);
      else next();
    },
    [
      openTab,
      navigateTab,
      updateQuery,
      tab.kind,
      tab.id,
      tab.key,
      tab.title,
      gates,
    ],
  );
  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = contentRef.current;
    const handle = (event: Event) =>
      navigate((event as CustomEvent<AccessoryDestination>).detail);
    node?.addEventListener("accessory-navigate", handle);
    return () => node?.removeEventListener("accessory-navigate", handle);
  }, [navigate]);
  const scope = useMemo(
    () => ({ tab, active, close, registerClose, navigate }),
    [tab, active, close, registerClose, navigate],
  );
  return (
    <div
      data-accessory-tab={tab.key}
      id={`accessory-content-${tab.key}`}
      role="tabpanel"
      aria-labelledby={`accessory-tab-${tab.key}`}
      hidden={!active}
      className="h-full min-h-0 overflow-auto"
      ref={(node) => {
        contentRef.current = node;
        node?.toggleAttribute("inert", !active);
      }}
    >
      <AccessoryTabContext.Provider value={scope}>
        <ResponsivePane className="h-full overflow-auto">
          <AccessoryView key={`${tab.kind}:${tab.id ?? ""}`} />
        </ResponsivePane>
      </AccessoryTabContext.Provider>
    </div>
  );
}
export function AccessoryTabs() {
  const panel = useAccessoryPanel();
  const gates = useRef(new Map<string, CloseGate>());
  const registerGate = useCallback((key: string, gate: CloseGate | null) => {
    if (gate) gates.current.set(key, gate);
    else gates.current.delete(key);
  }, []);
  const barRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const bar = barRef.current,
      tabs = tabsRef.current;
    if (!bar || !tabs) return;
    const measure = () => setOverflow(tabs.scrollWidth + 40 > bar.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(tabs);
    measure();
    return () => observer.disconnect();
  }, [panel?.tabs]);
  const activeKey = panel?.activeKey;
  useEffect(() => {
    if (activeKey)
      document
        .getElementById(`accessory-tab-${activeKey}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeKey]);
  if (!panel) return null;
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
    )
      return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? panel.tabs.length - 1
          : (index +
              (event.key === "ArrowRight" ? 1 : -1) +
              panel.tabs.length) %
            panel.tabs.length;
    panel.selectTab(panel.tabs[next].key);
    document.getElementById(`accessory-tab-${panel.tabs[next].key}`)?.focus();
  };
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={barRef}
        className="flex min-w-0 shrink-0 items-center gap-1 border-b bg-background px-2 py-2"
      >
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Accessory tabs"
          className="flex h-9 min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {panel.tabs.map((tab, index) => (
            <div
              key={tab.key}
              className={`group flex shrink-0 items-center rounded-lg transition-colors ${tab.key === panel.activeKey ? `${navLinkActiveStyles} text-foreground` : `${navLinkInactiveStyles} text-muted-foreground hover:text-foreground`}`}
            >
              <button
                id={`accessory-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={tab.key === panel.activeKey}
                aria-controls={`accessory-content-${tab.key}`}
                tabIndex={tab.key === panel.activeKey ? 0 : -1}
                onKeyDown={(event) => keyboard(event, index)}
                onClick={() => panel.selectTab(tab.key)}
                className="flex max-w-44 items-center gap-2 rounded-lg px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={tab.title}
              >
                <AccessoryIcon kind={tab.kind} />
                <span className="truncate">{tab.title}</span>

              </button>
              {tab.key === panel.activeKey &&
                ["tasks", "issues", "projects"].includes(tab.kind) && (
                  <div
                    role="group"
                    aria-label={`${tab.title} view`}
                    className="flex items-center gap-0.5 pr-1"
                  >
                    {(["list", "board"] as const).map((view) => {
                      const selected =
                        (new URLSearchParams(tab.query).get("view") ??
                          "list") === view;
                      const Icon = view === "list" ? List : Columns;
                      return (
                        <Button
                          key={view}
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${selected ? navLinkActiveStyles : navLinkInactiveStyles}`}
                          aria-label={`${tab.title} ${view} view`}
                          aria-pressed={selected}
                          onClick={() => {
                            const params = new URLSearchParams(tab.query);
                            params.set("view", view);
                            panel.updateQuery(tab.key, params.toString());
                          }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </Button>
                      );
                    })}
                  </div>
                )}
              <button
                type="button"
                aria-label={`Close ${tab.title} tab`}
                className="mr-1 rounded p-1 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  panel.selectTab(tab.key);
                  const gate = gates.current.get(tab.key);
                  if (gate) gate();
                  else panel.closeTab(tab.key);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div
          className={`flex h-9 shrink-0 items-center ${overflow ? "ml-auto" : ""}`}
        >
          <AccessoryTabPicker />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {panel.tabs.length ? (
          panel.tabs.map((tab) => (
            <TabContent
              key={tab.key}
              tab={tab}
              active={panel.expanded && tab.key === panel.activeKey}
              registerGate={registerGate}
              gates={gates}
            />
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Open messages, tasks, issues, projects or documents alongside your
              work.
            </p>
            <AccessoryTabPicker />
          </div>
        )}
      </div>
    </div>
  );
}
