'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { ChevronDown, Filter } from 'lucide-react';

export function CommunicationSourceFilter({
  options,
  sources,
  onToggle,
  compact = false,
}: {
  options: Array<{ id: string; label: string }>;
  sources: string[];
  onToggle: (id: string, checked: boolean) => void;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          className={compact ? 'flex-shrink-0' : 'h-7 shrink-0'}
          aria-label="Filter"
        >
          <Filter className={compact ? 'h-4 w-4' : 'mr-1 h-3 w-3'} />
          {compact ? null : (
            <>
              <span className="text-xs">Filter</span>
              <ChevronDown className="ml-1 h-3 w-3" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.id}
            checked={sources.includes(option.id)}
            onCheckedChange={(checked) => onToggle(option.id, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
