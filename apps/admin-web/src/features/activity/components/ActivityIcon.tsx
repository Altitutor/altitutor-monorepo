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
  'message': MessageSquare,
  'note': FileText,
  'file': FileText,
  'flag': Flag,
  'check': Check,
  'x': X,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowRight,
  'circle': Circle,
  'default': Circle,
};

const colorMap: Record<ActivityIconColor, string> = {
  blue: 'bg-blue-500 text-white',
  green: 'bg-green-500 text-white',
  gray: 'bg-gray-500 text-white',
  yellow: 'bg-yellow-500 text-white',
  red: 'bg-red-500 text-white',
  purple: 'bg-purple-500 text-white',
};

export function ActivityIcon({ icon, color, className }: ActivityIconProps) {
  const IconComponent = iconMap[icon] || Circle;
  const colorClass = colorMap[color] || colorMap.gray;

  return (
    <div className={cn('flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0', colorClass, className)}>
      <IconComponent className="w-4 h-4" />
    </div>
  );
}

