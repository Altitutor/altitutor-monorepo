import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import type { SharedLessonDocument } from '@altitutor/shared';

export function useSharedLessonDocuments(sessionID: string | null, enabled: boolean) {
  const userID = useAuthStore(state => state.user?.id);
  return useQuery({
    queryKey: ['tutor', 'shared-lesson-documents', userID, sessionID],
    enabled: Boolean(userID && sessionID && enabled),
    queryFn: async (): Promise<SharedLessonDocument[]> => {
      const response = await fetch('/api/lesson-documents?sessionID=' + encodeURIComponent(sessionID!), { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load shared lesson PDFs.');
      return await response.json() as SharedLessonDocument[];
    },
  });
}
