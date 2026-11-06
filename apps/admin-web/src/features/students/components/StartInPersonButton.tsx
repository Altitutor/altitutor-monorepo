'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, useToast } from '@altitutor/ui';
import { invalidateOnboarding } from '@/features/onboarding/api/queries';
import { studentsKeys } from '../hooks/useStudentsQuery';

export function StartInPersonButton({ studentId }: { studentId: string }) {
  const [starting, setStarting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  async function startInPerson() {
    setStarting(true);
    try {
      const response = await fetch(`/api/students/${studentId}/start-in-person`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to start in-person onboarding');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: studentsKeys.all }),
        invalidateOnboarding(queryClient),
      ]);
      toast({ title: 'In-person onboarding started', description: 'Send a registration link when the student is ready to register.' });
    } catch (error) {
      toast({ title: 'Could not start onboarding', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  }

  return <Button type="button" disabled={starting} onClick={() => void startInPerson()}>{starting ? 'Starting onboarding…' : 'Start in-person onboarding'}</Button>;
}
