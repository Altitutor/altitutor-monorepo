'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils';
import { shouldHideNavbar } from '@/shared/lib/shell-layout';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();
  const hideNavbar = shouldHideNavbar(pathname);

  return (
    <main className={cn('flex-1', !hideNavbar && 'pt-[var(--navbar-height)]')}>
      {children}
    </main>
  );
}
