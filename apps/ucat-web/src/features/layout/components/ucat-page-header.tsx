"use client";
import { Button } from "@/components/ui/button";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getBreadcrumbItems } from "@/features/layout/config/breadcrumbs";
import { UCAT_HEADER_ICON_BUTTON } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export type UcatBreadcrumbItem = {
  label: string;
  href?: string;
};

type UcatPageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  /** Override labels by segment index. E.g. { 2: mockName, 4: setName } for nested progress route. */
  breadcrumbOverrides?: Record<number, string>;
  /** When set, replaces pathname-derived breadcrumbs. */
  breadcrumbItems?: UcatBreadcrumbItem[];
};

export function UcatPageHeader({
  title,
  description,
  backHref,
  backLabel,
  breadcrumbOverrides,
  breadcrumbItems: customBreadcrumbItems,
}: UcatPageHeaderProps) {
  const pathname = usePathname();
  const pathnameBreadcrumbs = getBreadcrumbItems(pathname).map((item) => ({
    label: item.label,
    href: item.effectiveHref ?? undefined,
  }));

  const breadcrumbItems: UcatBreadcrumbItem[] =
    customBreadcrumbItems ??
    (breadcrumbOverrides && Object.keys(breadcrumbOverrides).length > 0
      ? pathnameBreadcrumbs.map((item, i) => {
          const override = breadcrumbOverrides[i];
          return override != null ? { ...item, label: override } : item;
        })
      : pathnameBreadcrumbs);

  return (
    <div className="space-y-4">
      {breadcrumbItems.length > 0 ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {breadcrumbItems.map((item, i) => (
              <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 ? (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-opacity duration-150"
                    aria-hidden
                  />
                ) : null}
                {i === breadcrumbItems.length - 1 ? (
                  <span className="font-medium text-foreground">
                    {item.label}
                  </span>
                ) : item.href ? (
                  <Link
                    href={item.href}
                    className="rounded-sm transition-colors duration-150 hover:text-foreground hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span>{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex items-start gap-3">
        {backHref ? (
          <Button
            variant="outline"
            size="icon"
            asChild
            className={cn(
              UCAT_HEADER_ICON_BUTTON,
              "group shrink-0 [&_svg]:size-5",
            )}
          >
            <Link href={backHref} aria-label={backLabel ?? "Go back"}>
              <ChevronLeft className="h-5 w-5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
