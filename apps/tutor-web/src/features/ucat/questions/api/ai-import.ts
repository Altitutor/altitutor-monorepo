import type { Json } from '@altitutor/shared'
import type {
  AiImportDraftStemPayload,
  AiImportIssue,
  AiImportQcResponse,
  AiImportSectionKey,
} from '@/features/ucat/questions/lib/ai-import/schema'

export type AiImportExtractResult = {
  status: 'success' | 'rejected'
  rejectionReason: string | null
  stems: AiImportDraftStemPayload[]
  extraction: unknown
  warnings: AiImportIssue[]
}

export const ucatAiImportApi = {
  async extract(args: {
    sectionId: string
    document: Json | null
    expectedQuestionCount?: number | null
  }): Promise<AiImportExtractResult> {
    const response = await fetch('/api/ucat/question-stems/ai-import/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to run AI extraction')
    }
    return response.json() as Promise<AiImportExtractResult>
  },

  async generateMissing(args: {
    section: AiImportSectionKey
    stems: AiImportDraftStemPayload[]
  }): Promise<{ stems: AiImportDraftStemPayload[]; updates: unknown[] }> {
    const response = await fetch('/api/ucat/question-stems/ai-import/generate-missing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to generate missing answers')
    }
    return response.json() as Promise<{ stems: AiImportDraftStemPayload[]; updates: unknown[] }>
  },

  async runQc(args: {
    section: AiImportSectionKey
    stems: AiImportDraftStemPayload[]
  }): Promise<{ stems: AiImportDraftStemPayload[]; issues: AiImportQcResponse['issues'] }> {
    const response = await fetch('/api/ucat/question-stems/ai-import/qc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to run QC')
    }
    return response.json() as Promise<{ stems: AiImportDraftStemPayload[]; issues: AiImportQcResponse['issues'] }>
  },
}
