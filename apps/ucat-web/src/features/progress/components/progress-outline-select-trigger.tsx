"use client";

import { forwardRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type ProgressOutlineSelectTriggerProps = {
  label: string;
  ariaLabel: string;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonProps, "children" | "variant" | "size" | "className">;

/** Outline button trigger for progress SearchableSelect controls. */
export const ProgressOutlineSelectTrigger = forwardRef<
  HTMLButtonElement,
  ProgressOutlineSelectTriggerProps
>(function ProgressOutlineSelectTrigger(
  { label, ariaLabel, className, children, type = "button", ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      type={type}
      variant="outline"
      size="sm"
      aria-label={ariaLabel}
      className={cn(
        UCAT_SURFACE_MOTION,
        "max-w-full justify-start gap-1.5 border-border px-3 shadow-sm",
        "hover:bg-muted/55 hover:shadow-md active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      <span className="truncate">{label}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      {children}
    </Button>
  );
});
