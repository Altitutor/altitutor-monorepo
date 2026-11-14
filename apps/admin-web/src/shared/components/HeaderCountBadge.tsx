import { RedCountBadge } from './RedCountBadge';

export function HeaderCountBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;

  return (
    <RedCountBadge count={count} tooltip={label ?? `${count} unread notifications`}
      className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center text-[10px]" />
  );
}
