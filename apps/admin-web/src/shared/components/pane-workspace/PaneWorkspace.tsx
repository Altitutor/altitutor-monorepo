"use client";

import { useRecordRecentPage } from "@/features/recently-viewed/useRecordRecentPage";
import { useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, FileText, FolderKanban, PanelTop, X } from "lucide-react";
import { navItems } from "@/shared/constants/adminNavigation";
import { navLinkActiveStyles, navLinkInactiveStyles } from "@/shared/utils";
import { toast } from "sonner";
import { ResponsivePane } from "@/shared/hooks/usePanelMediaQuery";
import { GoHintsContext } from "@/shared/shortcuts/context";
import { useMobileMenu } from "@/shared/contexts/MobileMenuContext";
import {
  openReferenceInPane, paneFrameAttribute, paneHref, paneRequestEvent,
  requestPane, withPaneCloseGate, type PaneRequest,
} from "./pane-routing";

const primary = "primary";
const minWidth = 305;
const subscribe = () => () => {};
const isEmbedded = () => window.frameElement?.hasAttribute(paneFrameAttribute) ?? false;
export function useEmbeddedPane() {
  return useSyncExternalStore(subscribe, isEmbedded, () => false);
}
type Peer = { id: string; initial: string; href: string };
type FrameMessage =
  | { action: "activate" | "ready" }
  | { action: "location"; href: string }
  | { action: "go-hints"; visible: boolean }
  | { action: "open"; href: string }
  | { action: "back" | "close" };

function getShiftDestination(event: MouseEvent) {
  if (!event.shiftKey || event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey) return false;
  if (!(event.target instanceof Element)) return false;
  const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
  if (anchor?.origin === location.origin && paneHref(anchor.pathname + anchor.search + anchor.hash)) {
    return requestPane("open", anchor.pathname + anchor.search + anchor.hash);
  }
  const chip = event.target.closest<HTMLElement>("[data-mention][data-id][data-type]");
  if (chip?.dataset.id && chip.dataset.type) return openReferenceInPane(chip.dataset.type, chip.dataset.id);
  const rowHref = paneHref(event.target.closest<HTMLElement>("[data-pane-href]")?.dataset.paneHref);
  if (rowHref) return requestPane("open", rowHref);
  const record = event.target.closest<HTMLElement>("[data-record-type][data-record-id]");
  return Boolean(record?.dataset.recordId && record.dataset.recordType &&
    openReferenceInPane(record.dataset.recordType, record.dataset.recordId));

}

function currentRoute(pathname: string, search: string) {
  return paneHref(`${pathname}${search ? `?${search}` : ""}`) ?? "/dashboard";
}

export function EmbeddedPaneEvents() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const goHints = useContext(GoHintsContext);
  useEffect(() => {
    window.parent.postMessage(
      { adminPane: { action: "go-hints", visible: goHints } satisfies FrameMessage },
      location.origin,
    );
  }, [goHints]);
  useEffect(() => {
    const send = (message: FrameMessage) => window.parent.postMessage({ adminPane: message }, location.origin);
    const activate = () => send({ action: "activate" });
    const handleRequest = (event: Event) => {
      const { action, href } = (event as CustomEvent<PaneRequest>).detail;
      const target = paneHref(href);
      if ((action === "navigate" || action === "replace" || action === "open") && !target) return;
      event.preventDefault();
      if (action === "open" && target) send({ action: "open", href: target });
      if (action === "close" || action === "back") withPaneCloseGate(() => send({ action }));
      if (target && action === "navigate") withPaneCloseGate(() => router.push(target));
      if (target && action === "replace") router.replace(target);
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent) return;
      const command = event.data?.adminPaneCommand as PaneRequest | undefined;
      if (command?.action === "close") requestPane("close");
      if (command?.action === "back") requestPane("back");
      if (command?.action === "navigate" && paneHref(command.href)) requestPane("navigate", command.href);
      if (command?.action === "replace" && paneHref(command.href)) requestPane("replace", command.href);
    };
    const shift = (event: MouseEvent) => {
      if (getShiftDestination(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("message", receive);
    window.addEventListener(paneRequestEvent, handleRequest);
    document.addEventListener("pointerdown", activate, true);
    document.addEventListener("focusin", activate, true);
    window.addEventListener("click", shift, true);
    send({ action: "ready" });
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener(paneRequestEvent, handleRequest);
      document.removeEventListener("pointerdown", activate, true);
      document.removeEventListener("focusin", activate, true);
      window.removeEventListener("click", shift, true);
    };
  }, [router]);
  useEffect(() => {
    window.parent.postMessage(
      { adminPane: { action: "location", href: currentRoute(pathname, search) } },
      location.origin,
    );
  }, [pathname, search]);
  return null;
}

function initialPeers(search: URLSearchParams): Peer[] {
  return search.getAll("pane").slice(0, 3).flatMap((value, index) => {
    const href = paneHref(value);
    return href ? [{ id: `linked-${index}`, href, initial: href }] : [];
  });
}

function paneTitle(href: string) {
  const names: Record<string, string> = { dashboard: "Home", sessions: "Sessions" };
  const segment = href.split(/[/?#]/)[1] || "dashboard";
  return names[segment] ?? segment.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
}

const paneIcons = { issues: AlertTriangle, projects: FolderKanban, documents: FileText, notes: FileText };

export function PaneWorkspace({
  children, staffId, onActivePathChange, onPeerGoHintsChange,
}: {
  children: ReactNode;
  staffId?: string;
  onActivePathChange?: (pathname: string) => void;
  onPeerGoHintsChange?: (visible: boolean) => void;
}) {
  const router = useRouter();
  const { close: closeMobileMenu } = useMobileMenu();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const mainHref = currentRoute(pathname, search);
  const params = new URLSearchParams(search);
  const [mainOpen, setMainOpen] = useState(() => params.get("hidePrimaryPane") !== "1");
  const [peers, setPeers] = useState(() => initialPeers(params).slice(0, mainOpen ? 2 : 3));
  const visibleIds = [...(mainOpen ? [primary] : []), ...peers.map((peer) => peer.id)];
  const [active, setActive] = useState(() => visibleIds[Number(params.get("activePane"))] ?? visibleIds[0] ?? primary);
  const [goHintPane, setGoHintPane] = useState<string | null>(null);
  const restoreFocus = useRef(false);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [width, setWidth] = useState(0);
  const frameRefs = useRef(new Map<string, HTMLIFrameElement>());
  const readyFrames = useRef(new Set<string>());
  const histories = useRef(new Map<string, string[]>());
  const pendingReplace = useRef(new Set<string>());
  const closePane = useRef<(id: string) => void>(() => {});
  const host = useRef<HTMLDivElement>(null);
  const narrow = visibleIds.length > 1 && width < visibleIds.length * minWidth;
  const hrefForPane = (id: string) => id === primary ? mainHref : peers.find((peer) => peer.id === id)?.href ?? mainHref;
  const activeHref = hrefForPane(active);
  const activePath = activeHref.split(/[?#]/)[0];
  useRecordRecentPage(staffId, active, activeHref, paneTitle(activeHref));
  useEffect(() => onActivePathChange?.(activePath), [activePath, onActivePathChange]);
  useEffect(() => onPeerGoHintsChange?.(goHintPane === active), [goHintPane, active, onPeerGoHintsChange]);
  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    document.getElementById(`workspace-${narrow ? "tab" : "pane"}-${active}`)?.focus();
  }, [peers, active, mainOpen, narrow]);
  const state = { active, peers, mainOpen, visibleIds, mainHref };
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function canReachPeer(id: string) {
    return readyFrames.current.has(id) &&
      Boolean(frameRefs.current.get(id)?.contentDocument?.querySelector("[data-admin-embedded-pane]"));
  }

  function send(id: string, command: PaneRequest) {
    frameRefs.current.get(id)?.contentWindow?.postMessage({ adminPaneCommand: command }, location.origin);
  }

  function workspaceUrl(href: string, snapshot = latest.current) {
    const url = new URL(href, location.origin);
    snapshot.peers.forEach((peer) => url.searchParams.append("pane", peer.href));
    if (!snapshot.mainOpen) url.searchParams.set("hidePrimaryPane", "1");
    const selected = snapshot.visibleIds.indexOf(snapshot.active);
    if (selected > 0) url.searchParams.set("activePane", String(selected));
    return url.pathname + url.search + url.hash;
  }

  useEffect(() => {
    if (visibleIds.length === 0) {
      setMainOpen(true);
      setActive(primary);
      return;
    }
    const url = workspaceUrl(mainHref);
    if (url !== location.pathname + location.search + location.hash) {
      window.history.replaceState(window.history.state, "", url);
    }
  // The current serialized routes and active pane fully describe the URL.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainHref, mainOpen, peers, active]);

  const lastMain = useRef(mainHref);
  useEffect(() => {
    if (lastMain.current === mainHref) return;
    if (!pendingReplace.current.delete(primary)) {
      histories.current.set(primary, [...(histories.current.get(primary) ?? []), lastMain.current]);
    }
    lastMain.current = mainHref;
  }, [mainHref]);

  useEffect(() => {
    function open(href: string) {
      const snapshot = latest.current;
      if (snapshot.visibleIds.length === 3) {
        toast.info("Close a pane before opening another.");
        return;
      }
      const id = crypto.randomUUID();
      setPeers((current) => [...current, { id, href, initial: href }]);
      setActive(id);
    }
    function paneHasFocus(id: string) {
      const focused = document.activeElement;
      return focused?.getAttribute("data-close-workspace-tab") === id ||
        document.getElementById(`workspace-pane-${id}`)?.contains(focused) === true;
    }
    function close(id: string, preserveFocus = paneHasFocus(id)) {
      const snapshot = latest.current;
      if (snapshot.visibleIds.length <= 1) return;
      const index = snapshot.visibleIds.indexOf(id);
      const remaining = snapshot.visibleIds.filter((key) => key !== id);
      if (id === primary) setMainOpen(false);
      else setPeers((current) => current.filter((peer) => peer.id !== id));
      histories.current.delete(id);
      readyFrames.current.delete(id);
      if (preserveFocus) restoreFocus.current = true;
      if (snapshot.active === id) setActive(remaining[Math.min(index, remaining.length - 1)]);
    }
    closePane.current = (id) => {
      if (id === primary) {
        const preserveFocus = paneHasFocus(id);
        withPaneCloseGate(() => close(id, preserveFocus));
      } else if (canReachPeer(id)) send(id, { action: "close" });
      else close(id);
    };
    function navigate(id: string, href: string, replace = false) {
      if (id === primary) {
        const run = () => {
          if (replace && href !== latest.current.mainHref) pendingReplace.current.add(primary);
          const url = workspaceUrl(href);
          if (replace) router.replace(url);
          else router.push(url);
        };
        if (replace) run();
        else withPaneCloseGate(run);
      } else if (canReachPeer(id)) {
        send(id, { action: replace ? "replace" : "navigate", href });
      } else {
        setPeers((current) => current.map((peer) => peer.id === id ? { ...peer, initial: href, href } : peer));
      }
    }
    function back(id: string) {
      const href = histories.current.get(id)?.pop();
      if (!href) return;
      pendingReplace.current.add(id);
      navigate(id, href, true);
    }
    const request = (event: Event) => {
      const { action, href, source } = (event as CustomEvent<PaneRequest>).detail;
      const target = paneHref(href);
      if ((action === "open" || action === "navigate" || action === "replace") && !target) return;
      const id = source === "primary" ? primary : latest.current.active;
      event.preventDefault();
      if (action === "open" && target) open(target);
      if ((action === "navigate" || action === "replace") && target) navigate(id, target, action === "replace");
      if (action === "close") closePane.current(id);
      if (action === "back") {
        if (id !== primary) send(id, { action });
        else withPaneCloseGate(() => back(id));
      }
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const id = [...frameRefs.current].find(([, frame]) => frame.contentWindow === event.source)?.[0];
      const message = event.data?.adminPane as FrameMessage | undefined;
      if (!id || !message) return;
      if (message.action === "ready") readyFrames.current.add(id);
      if (message.action === "activate") setActive(id);
      if (message.action === "go-hints") setGoHintPane((current) => message.visible ? id : current === id ? null : current);
      if (message.action === "close") close(id);
      if (message.action === "back") back(id);
      if (message.action === "open") {
        const href = paneHref(message.href);
        if (href) open(href);
      }
      if (message.action === "location") {
        const href = paneHref(message.href);
        const peer = latest.current.peers.find((value) => value.id === id);
        if (!href || !peer || peer.href === href) return;
        if (!pendingReplace.current.delete(id)) {
          histories.current.set(id, [...(histories.current.get(id) ?? []), peer.href]);
        }
        setPeers((current) => current.map((value) => value.id === id ? { ...value, href } : value));
      }
    };
    const click = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      const sidebarHref = link?.closest("[data-admin-sidebar], #admin-mobile-sidebar") &&
        link.origin === location.origin && paneHref(link.pathname + link.search + link.hash);
      const handled = getShiftDestination(event) ||
        (!event.defaultPrevented && event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey &&
          sidebarHref && requestPane("navigate", sidebarHref));
      if (!handled) return;
      if (sidebarHref) closeMobileMenu();
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener(paneRequestEvent, request);
    window.addEventListener("message", receive);
    window.addEventListener("click", click, true);
    return () => {
      window.removeEventListener(paneRequestEvent, request);
      window.removeEventListener("message", receive);
      window.removeEventListener("click", click, true);
    };
  // The listeners consult the latest workspace state through a ref.
  }, [router, closeMobileMenu]);

  function resize(index: number, delta: number, startLeft: number, startRight: number) {
    const left = visibleIds[index];
    const right = visibleIds[index + 1];
    const newLeft = Math.max(minWidth, Math.min(startLeft + startRight - minWidth, startLeft + delta));
    setWeights((current) => ({ ...current, [left]: newLeft, [right]: startLeft + startRight - newLeft }));
  }

  function renderPane(id: string, href: string, content: ReactNode) {
    const index = visibleIds.indexOf(id);
    const label = paneTitle(href);
    const hidden = index < 0 || (narrow && id !== active);
    return (
      <div key={id} hidden={hidden} style={{ flex: `${weights[id] ?? width / visibleIds.length} 1 0` }}
        className={hidden ? "hidden" : "flex min-h-0 min-w-0"}>
        <section
          aria-label={`${label} pane`}
          id={`workspace-pane-${id}`}
          tabIndex={-1}
          role={narrow ? "tabpanel" : undefined}
          aria-labelledby={narrow ? `workspace-tab-${id}` : undefined}
          data-shortcut-pane
          data-admin-active-pane={active === id ? "true" : undefined}
          onPointerDownCapture={() => setActive(id)}
          onFocusCapture={() => setActive(id)}
          className={`relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background ${active === id && visibleIds.length > 1 ? "border-primary/60" : "border-border"}`}
        >
          {!narrow && visibleIds.length > 1 && (
            <button type="button" aria-label={`Close ${label} pane`}
              onClick={() => closePane.current(id)}
              className="absolute left-0 top-0 z-20 grid size-6 place-items-center rounded-br-lg border-b border-r bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-ring">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
          {content}
        </section>
        {!narrow && index >= 0 && index < visibleIds.length - 1 && (
          <div role="separator" tabIndex={0} aria-label="Resize adjacent panes" aria-orientation="vertical"
            className="w-2 shrink-0 cursor-col-resize touch-none rounded-sm hover:bg-muted focus-visible:bg-muted"
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
              const left = event.currentTarget.parentElement;
              const right = left?.nextElementSibling;
              if (!left || !right) return;
              event.preventDefault();
              resize(index, event.key === "ArrowLeft" ? -24 : 24, left.clientWidth, right.clientWidth);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              const divider = event.currentTarget;
              const left = divider.parentElement;
              const right = left?.nextElementSibling;
              if (!left || !right) return;
              const start = event.clientX;
              const leftWidth = left.clientWidth;
              const rightWidth = right.clientWidth;
              divider.setPointerCapture(event.pointerId);
              const move = (pointer: PointerEvent) => resize(index, pointer.clientX - start, leftWidth, rightWidth);
              const stop = () => divider.removeEventListener("pointermove", move);
              divider.addEventListener("pointermove", move);
              divider.addEventListener("lostpointercapture", stop, { once: true });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-1" data-admin-pane-workspace>
      {narrow && (
        <div role="tablist" aria-label="Open panes" className="flex h-11 min-w-0 shrink-0 items-center gap-1 overflow-x-auto border-b bg-background px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleIds.map((id, index) => {
            const href = hrefForPane(id);
            const root = href.split(/[/?#]/)[1];
            const item = navItems.find((entry) => entry.type !== "heading" &&
              (entry.href === `/${root}` || entry.children?.some((child) => child.href === `/${root}`)));
            const Icon = paneIcons[root as keyof typeof paneIcons] ?? (item?.type !== "heading" ? item?.icon : undefined) ?? PanelTop;
            const label = paneTitle(href);
            return (
              <div key={id} className={`group flex shrink-0 items-center rounded-lg transition-colors ${id === active ? `${navLinkActiveStyles} text-foreground` : `${navLinkInactiveStyles} text-muted-foreground hover:text-foreground`}`}>
                <button id={`workspace-tab-${id}`} type="button" role="tab"
                  title={label} aria-selected={id === active} aria-controls={`workspace-pane-${id}`} tabIndex={id === active ? 0 : -1}
                  className="flex max-w-44 items-center gap-2 rounded-lg px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setActive(id)}
                  onKeyDown={(event) => {
                    const count = visibleIds.length;
                    const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1
                      : event.key === "ArrowLeft" ? (index - 1 + count) % count
                      : event.key === "ArrowRight" ? (index + 1) % count : null;
                    if (next === null) return;
                    event.preventDefault();
                    const nextId = visibleIds[next];
                    setActive(nextId);
                    document.getElementById(`workspace-tab-${nextId}`)?.focus();
                  }}>
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </button>
                <button type="button" data-close-workspace-tab={id} aria-label={`Close ${label} tab`} onClick={() => closePane.current(id)}
                  className="mr-1 rounded p-1 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div ref={host} className="flex min-h-0 min-w-0 flex-1">
        {renderPane(primary, mainHref, <ResponsivePane className="min-h-0 flex-1 overflow-hidden">{children}</ResponsivePane>)}
        {peers.map((peer) => renderPane(peer.id, peer.href,
          <iframe
            ref={(frame) => { if (frame) frameRefs.current.set(peer.id, frame); else frameRefs.current.delete(peer.id); }}
            data-admin-pane-frame
            title={`${paneTitle(peer.href)} pane content`}
            src={peer.initial}
            onLoad={(event) => {
              if (!event.currentTarget.contentDocument?.querySelector("[data-admin-embedded-pane]")) {
                readyFrames.current.delete(peer.id);
              }
            }}
            className="min-h-0 w-full flex-1 border-0"
          />,
        ))}
      </div>
    </div>
  );
}
