"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button, CardHeader, CardTitle } from "@altitutor/ui";
import { ExternalLink } from "lucide-react";

export function DashboardCardHeader({
  title,
  href,
  linkLabel,
  action,
  headerExtra,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  action?: ReactNode;
  headerExtra?: ReactNode;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 pb-2 pt-3">
      <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      <div className="flex items-center gap-2">
        {headerExtra}
        {action}
        {href ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={href} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              {linkLabel ?? title}
            </Link>
          </Button>
        ) : null}
      </div>
    </CardHeader>
  );
}
