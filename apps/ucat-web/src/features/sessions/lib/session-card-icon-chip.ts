import { cn } from "@/lib/utils";

export type SessionCardIconVariant = "today" | "default" | "future";

/**
 * Calendar / resource icon hit: **colors** from `/sessions` list (today vs future vs default),
 * **shape** from `/sessions/[id]` (`rounded-lg` + `h-9 w-9`).
 */
export function sessionCardIconChipClassName(
  variant: SessionCardIconVariant,
  className?: string,
) {
  return cn(
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
    variant === "today" && "bg-sidebar text-sidebar-foreground",
    variant === "future" && "bg-muted/80 text-muted-foreground",
    variant === "default" && "bg-muted text-muted-foreground",
    className,
  );
}
