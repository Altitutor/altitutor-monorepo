"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@altitutor/ui";
import { tutorBtnIconOutline } from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";

export type InterviewBreadcrumbItem = {
  label: string;
  href?: string;
};

export function InterviewBreadcrumb({
  items,
}: {
  items: InterviewBreadcrumbItem[];
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-foreground" : ""}>
                {item.label}
              </span>
            )}
            {!isLast ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
          </div>
        );
      })}
    </nav>
  );
}

export function InterviewPageHeader({
  title,
  actions,
  backHref,
  backLabel,
  breadcrumbs,
}: {
  title: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: InterviewBreadcrumbItem[];
}) {
  return (
    <>
      {breadcrumbs ? <InterviewBreadcrumb items={breadcrumbs} /> : null}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {backHref ? (
            <Button
              asChild
              variant="outline"
              size="icon"
              className={cn("mt-1", tutorBtnIconOutline)}
            >
              <Link href={backHref} aria-label={backLabel ?? "Back"}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </>
  );
}

export const interviewCrumbs = (
  label: string,
): InterviewBreadcrumbItem[] => [
  { label: "Interviews", href: "/interviews" },
  { label },
];
