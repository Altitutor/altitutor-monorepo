"use client"

import * as React from "react"
import { MoreHorizontal } from "lucide-react"

import { Button } from "./button"
import { SearchableSelect } from "./searchable-select"
import { cn } from "../lib/cn"

export interface TableActionItem {
  id: string
  label: string
  description?: string
  disabled?: boolean
  onSelect: () => void
}

export interface TableActionsProps {
  actions: TableActionItem[]
  label?: string
  searchPlaceholder?: string
  emptyMessage?: string
  align?: "start" | "center" | "end"
  className?: string
  triggerClassName?: string
}

export function TableActions({
  actions,
  label = "Actions",
  searchPlaceholder = "Search actions...",
  emptyMessage = "No actions found.",
  align = "end",
  className,
  triggerClassName,
}: TableActionsProps) {
  return (
    <SearchableSelect<TableActionItem>
      items={actions}
      value={null}
      onValueChange={(action) => action?.onSelect()}
      getItemId={(action) => action.id}
      getItemLabel={(action) => action.label}
      getItemValue={(action) => [action.label, action.description].filter(Boolean).join(" ")}
      getItemDisabled={(action) => action.disabled ?? false}
      placeholder={label}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      align={align}
      contentWidth="280px"
      showChevron={false}
      className={className}
      trigger={
        <Button
          type="button"
          variant="outline"
          className={cn("min-w-[9rem] justify-between", triggerClassName)}
        >
          <span>{label}</span>
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      }
      renderItem={(action) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{action.label}</div>
          {action.description ? (
            <div className="truncate text-xs text-muted-foreground">{action.description}</div>
          ) : null}
        </div>
      )}
    />
  )
}
