"use client";
import { ChevronRight } from "lucide-react";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { accessoryFamily } from "@/shared/contexts/AccessoryPanelContext";
export function AccessoryBreadcrumb({
  ownerIds = [],
  onCurrentClick,
}: {
  ownerIds?: Array<string | null | undefined>;
  onCurrentClick?: () => void;
}) {
  const scope = useAccessoryTab();
  if (!scope) return null;
  const owner =
    scope.tab.owner && ownerIds.includes(scope.tab.owner.id)
      ? scope.tab.owner
      : undefined;
  const family = accessoryFamily(owner?.kind ?? scope.tab.kind);
  const title = family.charAt(0).toUpperCase() + family.slice(1);
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-1.5 text-sm"
    >
      <button
        type="button"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() =>
          scope.navigate({
            kind: family,
            title,
            // Messages keeps the same kind for list + thread; clear the
            // conversation query so this crumb returns to the inbox.
            ...(family === "messages" ? { query: "" } : {}),
          })
        }
      >
        {title}
      </button>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {owner && (
        <>
          <button
            type="button"
            className="truncate text-muted-foreground hover:text-foreground"
            onClick={() => scope.navigate({ ...owner })}
          >
            {owner.title}
          </button>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </>
      )}
      {onCurrentClick ? (
        <button type="button" className="truncate text-left font-medium hover:underline" title={scope.tab.title} onClick={onCurrentClick}>
          {scope.tab.title}
        </button>
      ) : (
        <span className="truncate font-medium" title={scope.tab.title}>
          {scope.tab.title}
        </span>
      )}
    </nav>
  );
}
