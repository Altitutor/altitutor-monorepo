"use client";

import * as React from "react";
import {
  Button as UiButton,
  buttonVariants,
  type ButtonProps as UiButtonProps,
} from "@altitutor/ui";
import { UCAT_ACCENT_FILL_RISE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type FilledVariant = "default" | "destructive" | "secondary";

const FILLED_VARIANTS: ReadonlySet<string> = new Set([
  "default",
  "destructive",
  "secondary",
]);

function isFilledVariant(
  variant: UiButtonProps["variant"] | undefined,
): variant is FilledVariant {
  return FILLED_VARIANTS.has(variant ?? "default");
}

/** Overrides shadcn hover opacity classes so the bottom-up wash reads clearly. */
const FILLED_HOVER_RESET: Record<FilledVariant, string> = {
  default: "hover:bg-primary",
  destructive: "hover:bg-destructive",
  secondary: "hover:bg-secondary",
};

export type ButtonProps = UiButtonProps;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => {
    const resolvedVariant = variant ?? "default";
    const filled = isFilledVariant(resolvedVariant);

    return (
      <UiButton
        ref={ref}
        variant={variant}
        className={cn(
          filled && UCAT_ACCENT_FILL_RISE,
          filled && FILLED_HOVER_RESET[resolvedVariant],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
