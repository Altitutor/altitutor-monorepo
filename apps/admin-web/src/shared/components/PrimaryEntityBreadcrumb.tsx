"use client";
import { Breadcrumb } from "./Breadcrumb";
import { useBreadcrumbs } from "@/shared/hooks/useBreadcrumbs";
export function PrimaryEntityBreadcrumb({ label }: { label?: string }) {
  const breadcrumbs = useBreadcrumbs();
  const items = label
    ? breadcrumbs.map((item, index) =>
        index === breadcrumbs.length - 1 ? { ...item, label } : item,
      )
    : breadcrumbs;
  return (
    <Breadcrumb
      items={items}
      className="mb-0 min-w-0 flex-1 flex-wrap gap-1.5 [&>div]:min-w-0 [&>div:last-child]:flex-1 [&>div:last-child>span]:truncate"
    />
  );
}
