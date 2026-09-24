'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { TutorOfficePrintAccess } from '../lib/tutorOfficePrintAccess';

const ACCESS_VALUES = new Set<TutorOfficePrintAccess>(['off', 'office_hours', 'unrestricted']);

function parseAccess(value: unknown): TutorOfficePrintAccess {
  return typeof value === 'string' && ACCESS_VALUES.has(value as TutorOfficePrintAccess)
    ? (value as TutorOfficePrintAccess)
    : 'office_hours';
}

export function useTutorOfficePrintAccess(): {
  access: TutorOfficePrintAccess | null;
  isLoading: boolean;
} {
  const [access, setAccess] = useState<TutorOfficePrintAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('vtutor_office_print_settings')
        .select('tutor_access')
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setAccess('office_hours');
      } else {
        setAccess(parseAccess(data?.tutor_access));
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { access, isLoading };
}
