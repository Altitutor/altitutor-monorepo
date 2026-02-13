'use client';

import { useAuth } from '@/features/auth/providers/AuthProvider';
import { GetStartedSection } from '@/features/landing';

/**
 * App-level composition: composes GetStartedSection with auth state.
 * Decouples landing feature from auth feature.
 */
export function GetStartedSectionWithAuth() {
  const { session } = useAuth();
  return <GetStartedSection isLoggedIn={!!session} />;
}
