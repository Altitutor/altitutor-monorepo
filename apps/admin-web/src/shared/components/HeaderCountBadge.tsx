import { cn } from '@/shared/utils';

export function HeaderCountBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={label}
      className={cn(
        'absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold z-10',
        count > 9 && 'text-[9px]',
      )}
    >
      {count}
    </span>
  );
}
