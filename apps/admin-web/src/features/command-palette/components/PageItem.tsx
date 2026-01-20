/**
 * Page Item Component
 * Renders a page item in the command palette
 */

import { Badge } from '@altitutor/ui';
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
  id,
  title,
  icon: Icon,
  isSelected,
  searchQuery,
  onSelect,
  onMouseEnter,
}: PageItemProps) {
  const baseClasses = cn(
    'w-full flex items-start gap-3 px-4 py-3 rounded-md cursor-pointer transition-colors text-left',
    isSelected
      ? 'bg-brand-lightBlue/10 dark:bg-brand-lightBlue/20'
      : 'hover:bg-muted'
  );

  return (
    <button
      key={`page-${id}`}
      type="button"
      className={baseClasses}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={onMouseEnter}
    >
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 text-left">
        <div className="font-medium">{highlightText(title, searchQuery)}</div>
      </div>
      <Badge variant="outline" className="text-xs flex-shrink-0">
        Page
      </Badge>
    </button>
  );
}
