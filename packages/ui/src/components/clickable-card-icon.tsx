import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

type ClickableCardIconProps = {
  icon: LucideIcon;
  className?: string;
  size?: 'sm' | 'md';
};

const wrapSizeClass = {
  sm: 'h-10 w-10 p-2',
  md: 'p-2.5',
} as const;

const iconSizeClass = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
} as const;

export function ClickableCardIcon({
  icon: Icon,
  className,
  size = 'md',
}: ClickableCardIconProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl bg-muted/60 transition-colors duration-200 group-hover:bg-muted',
        wrapSizeClass[size],
        className,
      )}
    >
      <Icon
        className={cn(
          iconSizeClass[size],
          'text-muted-foreground transition-colors duration-200 group-hover:text-foreground',
        )}
        aria-hidden
      />
    </div>
  );
}
