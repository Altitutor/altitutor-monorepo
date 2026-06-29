import { Badge } from '@altitutor/ui';
import {
  commandPaletteItemActiveStyles,
  commandPaletteItemInactiveStyles,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import type { TutorCommandPaletteEntityResult } from '../types';
import { getEntityDisplayText } from '../utils/entityFormatters';
import { highlightText } from '../utils/highlighting';
import { entityTypes } from '../config/commandPalette.config';

const ENTITY_TYPE_MAPPING: Record<string, string> = {
  subject: 'subjects',
  topic: 'topics',
  file: 'files',
  flashcards: 'flashcards',
  class: 'classes',
};

interface EntityItemProps {
  result: TutorCommandPaletteEntityResult;
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
  const { title, subtitle, subjectPill } = getEntityDisplayText(result);

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
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2 text-left">
        {subjectPill ? (
          <Badge
            variant="secondary"
            className={cn(
              'shrink-0 rounded-lg px-2 py-0.5 text-xs',
              subjectPill.defaultClass || subjectPill.textColorClass,
            )}
            style={
              subjectPill.style.backgroundColor
                ? { backgroundColor: subjectPill.style.backgroundColor }
                : undefined
            }
          >
            {subjectPill.shortName}
          </Badge>
        ) : null}
        <div className="min-w-0">
          <span className="font-medium">{highlightText(title, searchQuery)}</span>
          {subtitle ? (
            <div className="text-sm text-muted-foreground">{highlightText(subtitle, searchQuery)}</div>
          ) : null}
        </div>
      </div>
      <Badge variant="outline" className="shrink-0 rounded-lg text-xs">
        {config.label}
      </Badge>
    </button>
  );
}
