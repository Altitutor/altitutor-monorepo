"use client";

import { TablePagination } from "@altitutor/ui";
import { UCAT_PAGINATION_ACTIVE_PAGE_BUTTON } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type ProgressTablePaginationProps = React.ComponentProps<
  typeof TablePagination
>;

/** TablePagination with padding; active page uses sidebar chrome (not primary accent). */
export function ProgressTablePagination({
  className,
  ...props
}: ProgressTablePaginationProps) {
  return (
    <div className={cn("pt-4 ucat-pagination", className)}>
      <TablePagination
        {...props}
        activePageButtonClassName={UCAT_PAGINATION_ACTIVE_PAGE_BUTTON}
      />
    </div>
  );
}
