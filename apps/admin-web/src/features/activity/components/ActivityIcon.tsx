import {
  UserPlus,
  UserMinus,
  Edit,
  X,
  Check,
  ArrowRight,
  MessageSquare,
  FileText,
  Flag,
  Circle,
  GraduationCap,
  Calendar,
  Tag,
  Box,
} from 'lucide-react';
import type { ActivityIconType, ActivityIconColor } from '../types';
import { cn } from '@/shared/utils';

interface ActivityIconProps {
  icon: ActivityIconType;
  color: ActivityIconColor;
  className?: string;
}

const iconMap: Record<ActivityIconType, typeof UserPlus> = {
  'user-plus': UserPlus,
  'user-minus': UserMinus,
  'user-edit': Edit,
  'class-plus': GraduationCap,
  'class-edit': GraduationCap,
  'session-plus': Calendar,
  'session-edit': Calendar,
  message: MessageSquare,
  note: FileText,
  file: FileText,
  flag: Flag,
  check: Check,
  x: X,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowRight,
  circle: Circle,
  default: Circle,
};

const iconContainerClass =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground';

function resolveDisplayIcon(icon: ActivityIconType): typeof UserPlus {
  if (icon === 'flag') return Tag;
  if (icon === 'default' || icon === 'circle') return Box;
  return iconMap[icon] || Circle;
}

export function ActivityIcon({ icon, color: _color, className }: ActivityIconProps) {
  const IconComponent = resolveDisplayIcon(icon);

  return (
    <div className={cn(iconContainerClass, className)}>
      <IconComponent className="h-3 w-3" />
    </div>
  );
}
