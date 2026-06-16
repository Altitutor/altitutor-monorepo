'use client'

import {
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@altitutor/ui'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/shared/utils'
import { tutorBtnOutline } from '@/shared/lib/tutor-visual'

export type UcatSearchScopeOption<T extends string> = {
  value: T
  label: string
}

export function formatUcatSearchScopeLabel<T extends string>(
  options: UcatSearchScopeOption<T>[],
  scopes: T[],
): string {
  if (scopes.length === options.length) return 'All content'
  if (scopes.length === 1) {
    return options.find((option) => option.value === scopes[0])?.label ?? 'Search in'
  }
  return `${scopes.length} fields`
}

type UcatSearchScopePillProps<T extends string> = {
  options: UcatSearchScopeOption<T>[]
  scopes: T[]
  onScopesChange: (scopes: T[]) => void
}

export function UcatSearchScopePill<T extends string>({
  options,
  scopes,
  onScopesChange,
}: UcatSearchScopePillProps<T>) {
  function toggleScope(scope: T) {
    onScopesChange(
      scopes.includes(scope)
        ? scopes.length === 1
          ? scopes
          : scopes.filter((value) => value !== scope)
        : [...scopes, scope],
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(tutorBtnOutline, 'h-7 shrink-0 rounded-full px-2.5 text-xs')}
        >
          <Search className="mr-1 h-3.5 w-3.5 opacity-70" />
          {formatUcatSearchScopeLabel(options, scopes)}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search fields..." />
          <CommandList>
            <CommandEmpty>No fields found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selected = scopes.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggleScope(option.value)}
                    className="flex items-center gap-2"
                  >
                    <Checkbox checked={selected} aria-label={option.label} className="pointer-events-none" />
                    <span>{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
