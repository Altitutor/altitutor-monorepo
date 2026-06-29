import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import clsx from "clsx";

type MarketingButtonProps = LinkProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: "filled" | "outline";
  };

export function MarketingButton({
  className,
  variant = "filled",
  ...props
}: MarketingButtonProps) {
  return (
    <Link
      className={clsx(
        "marketing-button",
        variant === "filled" ? "marketing-button--filled" : "marketing-button--outline",
        className,
      )}
      {...props}
    />
  );
}

type MarketingCardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "figure" | "div";
  tone?: "default" | "dark";
  padding?: "default" | "compact" | "large";
};

export function MarketingCard({
  as: Component = "article",
  className,
  tone = "default",
  padding = "default",
  ...props
}: MarketingCardProps) {
  return (
    <Component
      className={clsx(
        "marketing-card",
        tone === "dark" && "marketing-card--dark",
        padding !== "default" && `marketing-card--${padding}`,
        className,
      )}
      {...props}
    />
  );
}

type MarketingHeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3";
  variant?: "hero" | "section" | "card" | "display" | "footer";
};

export function MarketingHeading({
  as: Component = "h2",
  className,
  variant = "section",
  ...props
}: MarketingHeadingProps) {
  return <Component className={clsx("marketing-title", `marketing-title--${variant}`, className)} {...props} />;
}
