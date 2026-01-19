import { useState, useCallback } from 'react';
import { useToast } from '@altitutor/ui';

/**
 * Hook for copying text to clipboard with toast notifications
 * Returns the copy function and the currently copied field name
 */
export function useCopyToClipboard() {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = useCallback(
    async (text: string, field: string) => {
      if (!text || text === '-') return;

      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast({
          title: 'Copied!',
          description: 'Copied to clipboard',
        });
        setTimeout(() => setCopiedField(null), 2000);
      } catch (error: unknown) {
        toast({
          title: 'Failed to copy',
          description: 'Please try again',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  return { copy, copiedField };
}
