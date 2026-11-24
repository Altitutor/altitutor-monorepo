"use client";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";
import { ChevronRight } from "lucide-react";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { accessoryFamily } from "@/shared/contexts/AccessoryPanelContext";
export function AccessoryBreadcrumb({
  ownerIds = [],
  currentTitle,
  onCurrentClick,
}: {
  ownerIds?: Array<string | null | undefined>;
  currentTitle?: string | null;
  onCurrentClick?: () => void;
}) {
  const scope = useAccessoryTab();
  const { router } = usePaneNavigation();
  if (!scope) return null;
  const owner =
    scope.tab.owner && ownerIds.includes(scope.tab.owner.id)
      ? scope.tab.owner
      : undefined;
  const family = accessoryFamily(owner?.kind ?? scope.tab.kind);
  const title = family.charAt(0).toUpperCase() + family.slice(1);
  const label = currentTitle || scope.tab.title;
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-1.5 text-sm"
    >
      <button
        type="button"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => router.push(`/${family}`)}
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
        <button type="button" className="truncate text-left font-medium hover:text-foreground" title={label} onClick={onCurrentClick}>
          {label}
        </button>
      ) : (
        <span className="truncate font-medium" title={label}>
          {label}
        </span>
      )}
    </nav>
  );
}
