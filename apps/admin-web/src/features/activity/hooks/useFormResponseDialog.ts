'use client';

import { useCallback, useState } from 'react';
import type { FormResponseDetail } from '@/features/feedback/components/FormResponseDialog';

/**
 * Loads a form response for view/edit (same flow as session activity).
 */
export function useFormResponseDialog() {
  const [selectedResponse, setSelectedResponse] = useState<FormResponseDetail | null>(null);

  const openFormResponse = useCallback(async (responseId: string) => {
    if (!responseId) return;
    const response = await fetch(`/api/forms/responses?responseId=${encodeURIComponent(responseId)}`);
    const json = await response.json();
    if (response.ok) setSelectedResponse(json.responses?.[0] ?? null);
  }, []);

  const closeFormResponse = useCallback(() => {
    setSelectedResponse(null);
  }, []);

  return {
    selectedResponse,
    openFormResponse,
    closeFormResponse,
  };
}
