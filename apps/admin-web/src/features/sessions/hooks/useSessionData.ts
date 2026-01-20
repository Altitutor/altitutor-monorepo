import { useState, useEffect, useCallback } from 'react';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionsApi } from '../api/sessions';
import { classesApi } from '@/features/classes/api/classes';

interface UseSessionDataProps {
  sessionId: string | null;
  enabled?: boolean;
}

interface UseSessionDataReturn {
  data: any | null;
  isLoading: boolean;
  allTopics: Tables<'topics'>[];
  firstClassStaffId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for loading session data, topics, and related information
 */
export function useSessionData({
  sessionId,
  enabled = true,
}: UseSessionDataProps): UseSessionDataReturn {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);
  const [firstClassStaffId, setFirstClassStaffId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId || !enabled) return;
    setIsLoading(true);
    try {
      const result = await sessionsApi.getSessionWithTutorLog(sessionId);
      setData(result);

      // Fetch all topics for the subject
      const subjectId = (result.session as any)?.subject?.id || result.session?.class?.subject?.id;
      if (subjectId) {
        const supabaseClient = (await import('@/shared/lib/supabase/client')).getSupabaseClient() as SupabaseClient<Database>;
        const { data: topicsData } = await supabaseClient
          .from('topics')
          .select('*')
          .eq('subject_id', subjectId)
          .order('index', { ascending: true });

        setAllTopics(topicsData || []);
      }

      // If session is a CLASS type and has a class_id, get the first staff member from the class
      if (result.session?.type === 'CLASS' && result.session?.class_id) {
        try {
          const classStaff = await classesApi.getClassStaff(result.session.class_id);
          if (classStaff && classStaff.length > 0) {
            setFirstClassStaffId(classStaff[0].id);
          }
        } catch (error) {
          console.error('Failed to get class staff:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, enabled]);

  useEffect(() => {
    if (enabled && sessionId) {
      load();
    } else if (!enabled) {
      // Delay state reset to allow exit animation to complete
      const timer = setTimeout(() => {
        setData(null);
        setAllTopics([]);
        setFirstClassStaffId(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [sessionId, enabled, load]);

  const refresh = async () => {
    await load();
  };

  return {
    data,
    isLoading,
    allTopics,
    firstClassStaffId,
    refresh,
  };
}
