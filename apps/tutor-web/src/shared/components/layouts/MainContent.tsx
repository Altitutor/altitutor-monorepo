'use client';

import { usePathname } from 'next/navigation';
import { shouldHideNavbar } from '@/shared/lib/shell-layout';
import { cn } from '@/shared/utils';

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
