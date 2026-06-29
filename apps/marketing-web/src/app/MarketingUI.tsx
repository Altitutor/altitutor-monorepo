import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from "react";
import clsx from "clsx";
import styles from "./MarketingUI.module.css";

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
        styles.button,
        variant === "filled" ? styles.filled : styles.outline,
        className,
      )}
      data-marketing-button
      data-button-variant={variant}
      {...props}
    />
  );
}

type MarketingActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "filled" | "outline";
};

export function MarketingActionButton({
  className,
  variant = "filled",
  type = "button",
  ...props
}: MarketingActionButtonProps) {
  return (
    <button
      className={clsx(
        styles.button,
        variant === "filled" ? styles.filled : styles.outline,
        className,
      )}
      data-marketing-button
      data-button-variant={variant}
      type={type}
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
        styles.card,
        tone === "dark" && styles.dark,
        padding === "compact" && styles.compact,
        padding === "large" && styles.large,
        className,
      )}
      data-marketing-card
      data-card-tone={tone}
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
  const variantClass = variant === "card" ? styles.cardTitle : styles[variant];
  return <Component className={clsx(styles.title, variantClass, className)} data-marketing-title data-title-variant={variant} {...props} />;
}
