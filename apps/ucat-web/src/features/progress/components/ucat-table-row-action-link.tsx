"use client";
import { Button } from "@/components/ui/button";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type UcatTableRowActionLinkProps = {
  href: string;
  label: string;
};

/**
 * Outline row action (e.g. view attempt) with chevron and hover motion for progress tables.
 */
export function UcatTableRowActionLink({ href, label }: UcatTableRowActionLinkProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className={cn(
        UCAT_SURFACE_MOTION,
        "group border-border px-3 shadow-sm hover:bg-muted/55 hover:shadow-md active:scale-[0.98]",
      )}
    >
      <Link href={href} className="inline-flex items-center gap-1">
        <span>{label}</span>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 opacity-65 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    </Button>
  );
}
