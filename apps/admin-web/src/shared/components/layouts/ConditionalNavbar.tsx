'use client';

import { useAuthStore } from '@/shared/lib/supabase/auth';
import { Navbar } from './Navbar';

export function ConditionalNavbar() {
  const { user } = useAuthStore();
  
  if (!user) {
    return null;
  }
  
  return <Navbar />;
}
