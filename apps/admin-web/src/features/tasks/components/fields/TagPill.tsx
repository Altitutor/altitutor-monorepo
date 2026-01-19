'use client';

import { Badge } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import type { TagEntityType } from '../../utils/tagParsing';
import {
  GraduationCap,
  UserRound,
  Users,
  Calendar,
  Beaker,
  Newspaper,
  File,
  ClipboardList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TagPillProps {
  type: TagEntityType;
  displayText: string;
  onClick?: () => void;
  className?: string;
}

const entityIcons: Record<TagEntityType, LucideIcon> = {
  student: GraduationCap,
  staff: Users,
  parent: UserRound,
  class: Calendar,
  session: ClipboardList,
  topic: Newspaper,
  file: File,
};

const entityColors: Record<TagEntityType, string> = {
  student: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  staff: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  parent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  class: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  session: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  topic: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  file: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export function TagPill({
  type,
  displayText,
  onClick,
  className,
}: TagPillProps) {
  const Icon = entityIcons[type];
  const colorClass = entityColors[type];

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity',
        colorClass,
        className
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
    >
      <Icon className="h-3 w-3" />
      <span>{displayText}</span>
    </Badge>
  );
}
