'use client';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { ListFilter } from 'lucide-react';
import { EmailIconButton } from '@/features/email/components/EmailIconButton';

export function CommunicationSourceFilter({
  options,
  sources,
  onToggle,
}: {
  options: Array<{ id: string; label: string }>;
  sources: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <EmailIconButton label="Filter">
          <ListFilter className="h-4 w-4" />
        </EmailIconButton>
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
