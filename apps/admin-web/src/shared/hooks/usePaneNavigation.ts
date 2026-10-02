"use client";
import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  useAccessoryPanel,
  type AccessoryKind,
  accessoryFamily,
} from "@/shared/contexts/AccessoryPanelContext";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { ownedPrimaryHref } from "@/shared/utils/primaryOwnership";
export const ACCESSORY_ROUTES: Record<
  string,
  { kind: AccessoryKind; detail?: AccessoryKind; title: string }
> = {
  today: { kind: "today", title: "Today" },
  tasks: { kind: "tasks", detail: "task", title: "Tasks" },
  issues: { kind: "issues", detail: "issue", title: "Issues" },
  projects: { kind: "projects", detail: "project", title: "Projects" },
  documents: { kind: "documents", detail: "document", title: "Documents" },
  notes: { kind: "documents", detail: "document", title: "Documents" },
  messages: { kind: "messages", title: "Messages" },
};
export function accessoryDestination(href: string) {
  const url = new URL(href, "http://admin.local");
  const [route, id] = url.pathname.split("/").filter(Boolean);
  const destination = ACCESSORY_ROUTES[route] ?? ACCESSORY_ROUTES[`${route}s`];
  if (!destination) return null;
  return {
    kind: id && destination.detail ? destination.detail : destination.kind,
    id:
      id ??
      (route === "messages"
        ? (url.searchParams.get("contact") ??
          url.searchParams.get("group") ??
          undefined)
        : undefined),
    title: id ? destination.title.replace(/s$/, "") : destination.title,
    query: url.search.slice(1),
  };
}
/** Accessory views own their query state; primary views continue to use Next routing. */
export function usePaneNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panel = useAccessoryPanel();
  const scope = useAccessoryTab();
  return useMemo(() => {
    const navigate = (href: string, options?: { scroll?: boolean }) => {
      const target = accessoryDestination(href);
      if (panel && target) {
        if (
          scope &&
          target.kind === scope.tab.kind &&
          (target.id === scope.tab.id || target.kind === "messages")
        )
          panel.updateQuery(scope.tab.key, target.query);
        else if (scope) scope.navigate(target);
        else panel.openTab(target);
      } else {
        if (
          document.getElementById("admin-accessory-panel")?.dataset.docked ===
          "false"
        )
          panel?.collapse();
        router.push(scope ? href : ownedPrimaryHref(href, pathname, new URLSearchParams(searchParams.toString())), options);
      }
    };
    return {
      router: { ...router, push: navigate, replace: navigate },
      pathname: scope
        ? `/${accessoryFamily(scope.tab.kind)}${scope.tab.id && scope.tab.kind !== "messages" ? `/${scope.tab.id}` : ""}`
        : pathname,
      searchParams: scope ? new URLSearchParams(scope.tab.query) : searchParams,
    };
  }, [router, pathname, searchParams, panel, scope]);
}
