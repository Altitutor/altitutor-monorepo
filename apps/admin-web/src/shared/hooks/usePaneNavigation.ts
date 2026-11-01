"use client";
import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  useAccessoryPanelActions,
  type AccessoryKind,
  accessoryFamily,
} from "@/shared/contexts/AccessoryPanelContext";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { ownedPrimaryHref } from "@/shared/utils/primaryOwnership";
export const ACCESSORY_ROUTES: Record<
  string,
  { kind: AccessoryKind; title: string }
> = {
  tasks: { kind: "task", title: "Task" },
  issues: { kind: "issue", title: "Issue" },
  projects: { kind: "project", title: "Project" },
  documents: { kind: "document", title: "Document" },
  notes: { kind: "document", title: "Document" },
  email: { kind: "email", title: "Email" },
  messages: { kind: "messages", title: "Messages" },
};
export function accessoryDestination(href: string) {
  const url = new URL(href, "http://admin.local");
  const [route, pathId] = url.pathname.split("/").filter(Boolean);
  const destination = ACCESSORY_ROUTES[route] ?? ACCESSORY_ROUTES[`${route}s`];
  if (!destination) return null;
  const id = pathId ?? (destination.kind === "messages"
    ? url.searchParams.get("contact") ?? url.searchParams.get("group") ?? url.searchParams.get("conversation")
    : null);
  if (!id) return null;
  return { ...destination, id, query: url.search.slice(1) };
}
/** Accessory views own their query state; primary views continue to use Next routing. */
export function usePaneNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panel = useAccessoryPanelActions();
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
