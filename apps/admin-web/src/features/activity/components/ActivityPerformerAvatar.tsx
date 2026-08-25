import { cn } from '@/shared/utils';
import { getPerformerAvatarColorClass, getPerformerInitials } from '../lib/performerDisplay';

interface ActivityPerformerAvatarProps {
  name: string;
  className?: string;
}

export function ActivityPerformerAvatar({ name, className }: ActivityPerformerAvatarProps) {
  return (
    <div
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium',
        getPerformerAvatarColorClass(name),
        className,
      )}
      aria-hidden
    >
      {getPerformerInitials(name)}
    </div>
  );
}
