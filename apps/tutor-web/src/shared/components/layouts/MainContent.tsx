'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { shouldHideNavbar } from '@/shared/lib/shell-layout';
import { cn } from '@/shared/utils';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();
  const [formResponseSubmitted, setFormResponseSubmitted] = useState(false);
  const hideNavbar = shouldHideNavbar(pathname) && !formResponseSubmitted;

  useEffect(() => {
    setFormResponseSubmitted(false);
    const showNavbar = () => setFormResponseSubmitted(true);
    window.addEventListener('altitutor:form-submitted', showNavbar);
    return () => window.removeEventListener('altitutor:form-submitted', showNavbar);
  }, [pathname]);

  return (
    <main className={cn('flex-1', !hideNavbar && 'pt-[var(--navbar-height)]')}>
      {children}
    </main>
  );
}
