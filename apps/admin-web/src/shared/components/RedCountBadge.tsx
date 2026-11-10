import { cn } from '@/shared/utils';

export function RedCountBadge({ count, className }: { count: number | string; className?: string }) {
  return <span className={cn('shrink-0 rounded-full bg-red-500 px-1.5 text-xs font-bold tabular-nums text-white', className)}>{count}</span>;
}
