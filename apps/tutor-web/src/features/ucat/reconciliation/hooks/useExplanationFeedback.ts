import { useQuery } from '@tanstack/react-query'
import type { ExplanationFeedbackSummary } from '@/features/ucat/reconciliation/api/reconciliation'

export function useExplanationFeedback(stemId: string | null | undefined) {
  return useQuery({
    queryKey: ['ucat', 'explanation-feedback', stemId],
    enabled: Boolean(stemId),
    queryFn: async () => {
      const response = await fetch(`/api/ucat/explanation-feedback?stemId=${encodeURIComponent(stemId ?? '')}`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'Could not load explanation feedback')
      return (body.feedback ?? []) as ExplanationFeedbackSummary[]
    },
  })
}
