'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();

  return (
    <main className={cn('flex-1', pathname !== '/login' && 'pt-[var(--navbar-height)]')}>
      {children}
    </main>
  );
}
