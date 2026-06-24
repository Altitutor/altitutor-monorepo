import { Badge } from '@altitutor/ui';
import {
  commandPaletteItemActiveStyles,
  commandPaletteItemInactiveStyles,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import type { LucideIcon } from 'lucide-react';
import { highlightText } from '../utils/highlighting';

interface PageItemProps {
  id: string;
  title: string;
  icon: LucideIcon;
  isSelected: boolean;
  searchQuery: string;
  onSelect: () => void;
  onMouseEnter: () => void;
}

export function PageItem({
  title,
  icon: Icon,
  isSelected,
  searchQuery,
  onSelect,
  onMouseEnter,
}: PageItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full cursor-pointer items-start gap-3 rounded-xl px-4 py-3 text-left',
        isSelected ? commandPaletteItemActiveStyles : commandPaletteItemInactiveStyles,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={onMouseEnter}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-left">
        <div className="font-medium">{highlightText(title, searchQuery)}</div>
      </div>
      <Badge variant="outline" className="shrink-0 rounded-lg text-xs">
        Page
      </Badge>
    </button>
  );
}
