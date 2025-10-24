'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';

type StudentAvatarProps = {
  student: Tables<'students'>;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function StudentAvatar({ student, showTooltip = true, size = 'md', className }: StudentAvatarProps) {
  const initials = `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase();
  const fullName = `${student.first_name} ${student.last_name}`;
  
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };
  
  const avatar = (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-blue-500 text-white font-medium',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
  
  if (!showTooltip) {
    return avatar;
  }
  
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {avatar}
        </TooltipTrigger>
        <TooltipContent>
          <p>{fullName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

