"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import type { LinkProps } from "next/link";
import { captureMarketingEvent } from "@/lib/analytics/posthog";

type AnalyticsLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children?: ReactNode;
  analytics: {
    product: "ucat" | "online-learning" | "in-person";
    placement: string;
    action: string;
    planTier?: string;
  };
  };

export function AnalyticsLink({
  analytics,
  onClick,
  ...props
}: AnalyticsLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        captureMarketingEvent("marketing_cta_clicked", {
          product: analytics.product,
          cta_placement: analytics.placement,
          cta_action: analytics.action,
          plan_tier: analytics.planTier,
          destination: String(props.href),
        });
        onClick?.(event);
      }}
    />
  );
}
