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
      {children}
    </main>
  );
}
