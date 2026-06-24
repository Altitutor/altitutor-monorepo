import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';

type ClickableCardRevealChevronProps = {
  className?: string;
  size?: 'sm' | 'md';
  direction?: 'left' | 'right';
};

const sizeClass = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
} as const;

const revealClass =
  'shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-foreground focus-within:translate-x-0.5 focus-within:opacity-100 focus-within:text-foreground';

const revealLeftClass =
  'shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:-translate-x-0.5 group-hover:opacity-100 group-hover:text-foreground focus-within:-translate-x-0.5 focus-within:opacity-100 focus-within:text-foreground';

export function ClickableCardRevealChevron({
  className,
  size = 'md',
  direction = 'right',
}: ClickableCardRevealChevronProps) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;

  return (
    <Icon
      className={cn(sizeClass[size], direction === 'left' ? revealLeftClass : revealClass, className)}
      aria-hidden
    />
  );
}
