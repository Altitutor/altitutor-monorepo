'use client';

import { useAuthStore } from '@/shared/lib/supabase/auth';

export function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  
  // Only apply padding-top when user is logged in (navbar is visible)
  return (
    <main className={`flex-1 ${user ? 'pt-[var(--navbar-height)]' : ''}`}>
      {children}
    </main>
  );
}
