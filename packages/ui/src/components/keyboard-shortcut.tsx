import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

/** Shared keycap presentation for shortcuts, tooltips and command menus. */
export function KeyboardShortcut({
  keys,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { keys: readonly string[] }) {
  return (
    <span
      aria-label={keys.join("+")}
      className={cn(
        "pointer-events-none inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground",
        className,
      )}
      {...props}
    >
      {keys.map((key, index) => (
        <kbd
          key={`${key}:${index}`}
          className="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border bg-muted/50 px-1 font-sans font-medium leading-none"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
