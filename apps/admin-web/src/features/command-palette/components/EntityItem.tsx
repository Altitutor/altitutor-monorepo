/**
 * Entity Item Component
 * Renders an entity item in the command palette
 */

import { Badge } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import type { CommandPaletteEntityResult } from '../types';
import { getEntityDisplayText } from '../utils/entityFormatters';
import { highlightText } from '../utils/highlighting';
import { entityTypes } from '../config/commandPalette.config';

// Map singular entity types to plural keys in entityTypes config
const ENTITY_TYPE_MAPPING: Record<string, string> = {
  student: 'students',
  staff: 'staff',
  parent: 'parents',
  class: 'classes',
  subject: 'subjects',
  task: 'tasks',
  issue: 'issues',
  project: 'projects',
  topic: 'topics',
  file: 'files',
  note: 'notes',
};

interface EntityItemProps {
  result: CommandPaletteEntityResult;
  isSelected: boolean;
  searchQuery: string;
  onSelect: () => void;
  onMouseEnter: () => void;
}

export function EntityItem({
  result,
  isSelected,
  searchQuery,
  onSelect,
  onMouseEnter,
}: EntityItemProps) {
  const configKey = ENTITY_TYPE_MAPPING[result.type] || result.type;
  const config = entityTypes[configKey];
  if (!config) return null;

  const Icon = config.icon;
  const { title, subtitle } = getEntityDisplayText(result);

  const baseClasses = cn(
    'w-full flex items-start gap-3 px-4 py-3 rounded-md cursor-pointer transition-colors text-left',
    isSelected
      ? 'bg-brand-lightBlue/10 dark:bg-brand-lightBlue/20'
      : 'hover:bg-muted'
  );

  return (
    <button
      key={`entity-${result.type}-${result.id}`}
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
        {subtitle && (
          <div className="text-sm text-muted-foreground">
            {highlightText(subtitle, searchQuery)}
          </div>
        )}
      </div>
      <Badge variant="outline" className="text-xs flex-shrink-0">
        {config.label}
      </Badge>
    </button>
  );
}
