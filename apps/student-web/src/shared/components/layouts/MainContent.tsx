'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();
  const hideNavbar = pathname === '/booking/trial-session' || pathname === '/booking-success';

  return (
    <main className={cn('flex-1', !hideNavbar && 'pt-[var(--navbar-height)]')}>
      <div
        key={pathname}
        className={cn(
          'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-motion-enter motion-safe:ease-motion-standard motion-safe:fill-mode-both',
          'motion-reduce:animate-none motion-reduce:opacity-100',
        )}
      >
        {children}
      </div>
    </main>
  );
}
