"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from "react";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import { ucatClickableCardClassName } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export type UcatClickableCardLayout = "stacked" | "inline";

type UcatClickableCardIconComponent = LucideIcon | ComponentType<{ className?: string }>;

type UcatClickableCardContentProps = {
  layout?: UcatClickableCardLayout;
  icon?: UcatClickableCardIconComponent;
  iconNode?: ReactNode;
  iconClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Badges or labels rendered beside the title (inline layout). */
  titleAddon?: ReactNode;
  /** Replaces the default hover chevron in the header row. */
  trailing?: ReactNode;
  showChevron?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
};

const defaultIconChipClassName =
  "rounded-lg bg-muted/60 p-2.5 transition-colors duration-200 group-hover:bg-muted";

const defaultIconClassName =
  "h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground";

export function UcatClickableCardIcon({
  icon: Icon,
  children,
  className,
}: {
  icon?: UcatClickableCardIconComponent;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        defaultIconChipClassName,
        className,
      )}
    >
      {children ??
        (Icon ? (
          <Icon className={defaultIconClassName} aria-hidden />
        ) : null)}
    </div>
  );
}

export function UcatClickableCardContent({
  layout = "stacked",
  icon,
  iconNode,
  iconClassName,
  title,
  description,
  titleAddon,
  trailing,
  showChevron = true,
  titleClassName,
  descriptionClassName,
}: UcatClickableCardContentProps) {
  const iconElement =
    iconNode ??
    (icon ? (
      <UcatClickableCardIcon icon={icon} className={iconClassName} />
    ) : null);

  if (layout === "inline") {
    return (
      <div className="flex items-center gap-4">
        {iconElement}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className={cn("font-semibold leading-tight", titleClassName)}>
              {title}
            </h3>
            {titleAddon}
          </div>
          {description ? (
            <p
              className={cn("text-sm text-muted-foreground", descriptionClassName)}
            >
              {description}
            </p>
          ) : null}
        </div>
        {trailing ?? (showChevron ? <UcatHoverChevron /> : null)}
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full items-start justify-between">
        {iconElement}
        {trailing ?? (showChevron ? <UcatHoverChevron /> : null)}
      </div>
      <h3 className={cn("mt-4 font-semibold", titleClassName)}>{title}</h3>
      {description ? (
        <p className={cn("mt-1 text-sm text-muted-foreground", descriptionClassName)}>
          {description}
        </p>
      ) : null}
    </>
  );
}

type UcatClickableCardLinkProps = UcatClickableCardContentProps & {
  href: string;
  className?: string;
  interactive?: boolean;
};

export function UcatClickableCardLink({
  href,
  className,
  interactive = true,
  ...contentProps
}: UcatClickableCardLinkProps) {
  return (
    <Link
      href={href}
      className={ucatClickableCardClassName({ interactive, className })}
    >
      <UcatClickableCardContent {...contentProps} />
    </Link>
  );
}

type UcatClickableCardButtonProps = UcatClickableCardContentProps &
  Pick<
    ComponentPropsWithoutRef<"button">,
    "onClick" | "type" | "aria-label" | "aria-pressed"
  > & {
    className?: string;
    interactive?: boolean;
    selected?: boolean;
  };

export function UcatClickableCardButton({
  onClick,
  type = "button",
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
  className,
  interactive = true,
  selected = false,
  ...contentProps
}: UcatClickableCardButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed ?? selected}
      className={ucatClickableCardClassName({ interactive, selected, className })}
    >
      <UcatClickableCardContent {...contentProps} />
    </button>
  );
}

type UcatClickableCardSurfaceProps = UcatClickableCardContentProps & {
  className?: string;
  interactive?: boolean;
  selected?: boolean;
};

/** Card surface without its own link/button — wrap with Link or button as needed. */
export function UcatClickableCardSurface({
  className,
  interactive = true,
  selected = false,
  ...contentProps
}: UcatClickableCardSurfaceProps) {
  return (
    <div className={ucatClickableCardClassName({ interactive, selected, className })}>
      <UcatClickableCardContent {...contentProps} />
    </div>
  );
}
