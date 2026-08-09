import type { Json } from '@altitutor/shared'
import {
  extractDecisionMakingCategoryEvidence,
  inferDecisionMakingCategory,
  type DecisionMakingCategoryInferenceValue,
  type InferenceConfidence,
} from './responseClassification'

export type DecisionMakingAuditQuestionRecord = {
  id: string
  question_text: Json
  deleted_at: string | null
}

/** Structured database projection consumed by the offline audit. */
export type DecisionMakingAuditRecord = {
  stem_id: string
  current_category: string
  stem_text: Json
  presentation_format?: string | null
  status: string
  deleted_at: string | null
  questions: DecisionMakingAuditQuestionRecord[]
}

export type DecisionMakingCategoryAuditRow = {
  stemId: string
  currentCategory: string
  status: string
  stemLifecycle: 'active' | 'stem_deleted'
  activeQuestionIds: string[]
  softDeletedQuestionIds: string[]
  presentationFormat: string | null
  richNodeTypes: string[]
  assetFileIds: string[]
  stemTextExcerpt: string
  directiveExcerpt: string
  formalPremiseSignals: string[]
  factualDataSignals: string[]
  suggestedCategory: DecisionMakingCategoryInferenceValue | null
  confidence: InferenceConfidence
  evidence: string[]
  conflicts: string[]
  requiresHumanReview: boolean
}

export type DecisionMakingCategoryAuditReport = {
  schemaVersion: 1
  summary: {
    totalStems: number
    activeStems: number
    stemDeletedStems: number
    activeQuestions: number
    softDeletedQuestions: number
    suggestedSyllogisms: number
    suggestedInterpretingInformation: number
    requiresHumanReview: number
  }
  rows: DecisionMakingCategoryAuditRow[]
}

const STRUCTURAL_NODE_TYPES = new Set(['doc', 'paragraph', 'text', 'hardBreak'])

function inspectRichContent(value: Json): {
  text: string
  nodeTypes: string[]
  assetFileIds: string[]
} {
  const types = new Set<string>()
  const fileIds = new Set<string>()
  const text: string[] = []
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    const record = node as Record<string, unknown>
    if (record.type === 'text' && typeof record.text === 'string') {
      text.push(record.text)
    }
    if (record.attrs && typeof record.attrs === 'object' && !Array.isArray(record.attrs)) {
      const attrs = record.attrs as Record<string, unknown>
      if (typeof attrs.fileId === 'string' && attrs.fileId.length > 0) {
        fileIds.add(attrs.fileId)
      }
      if (record.type === 'image' && typeof attrs.alt === 'string') {
        text.push(attrs.alt)
      }
      if (
        (record.type === 'inlineMath' || record.type === 'blockMath') &&
        typeof attrs.latex === 'string'
      ) {
        text.push(attrs.latex)
      }
    }
    if (
      typeof record.type === 'string' &&
      !STRUCTURAL_NODE_TYPES.has(record.type)
    ) {
      types.add(record.type)
    }
    if (Array.isArray(record.content)) record.content.forEach(visit)
  }
  visit(value)
  return {
    text: text.join(' ').replace(/\s+/gu, ' ').trim(),
    nodeTypes: [...types].sort(),
    assetFileIds: [...fileIds].sort(),
  }
}

function excerpt(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 500)
}

/**
 * Audits persisted stems through the same semantic category classifier used by
 * authoring. Response type, answer scheme, and answer shape are intentionally
 * absent from both the input projection and the inference call.
 */
export function auditDecisionMakingCategoryRecords(
  records: readonly DecisionMakingAuditRecord[]
): DecisionMakingCategoryAuditRow[] {
  return records.map((record) => {
    const stemContent = inspectRichContent(record.stem_text)
    const stemText = stemContent.text
    const directive = record.questions
      .map((question) => inspectRichContent(question.question_text).text)
      .join(' ')
    const nodeTypes = stemContent.nodeTypes
    const semanticStemProbe = [
      stemText,
      record.presentation_format,
      ...nodeTypes,
    ].filter(Boolean).join(' ')
    const semanticEvidence = extractDecisionMakingCategoryEvidence({
      stemText: semanticStemProbe,
      directive,
    })
    const inference = inferDecisionMakingCategory({
      stemText: semanticStemProbe,
      directive,
    })

    return {
      stemId: record.stem_id,
      currentCategory: record.current_category,
      status: record.status,
      stemLifecycle: record.deleted_at ? 'stem_deleted' : 'active',
      activeQuestionIds: record.questions
        .filter((question) => question.deleted_at === null)
        .map((question) => question.id),
      softDeletedQuestionIds: record.questions
        .filter((question) => question.deleted_at !== null)
        .map((question) => question.id),
      presentationFormat: record.presentation_format ?? null,
      richNodeTypes: nodeTypes,
      assetFileIds: stemContent.assetFileIds,
      stemTextExcerpt: excerpt(stemText),
      directiveExcerpt: excerpt(directive),
      formalPremiseSignals: semanticEvidence.formalPremiseSignals,
      factualDataSignals: semanticEvidence.factualDataSignals,
      suggestedCategory: inference.value,
      confidence: inference.confidence,
      evidence: inference.evidence,
      conflicts: inference.conflicts,
      requiresHumanReview:
        inference.value === null ||
        inference.confidence === 'weak' ||
        inference.confidence === 'absent' ||
        inference.conflicts.length > 0,
    }
  })
}

export function buildDecisionMakingCategoryAuditReport(
  records: readonly DecisionMakingAuditRecord[]
): DecisionMakingCategoryAuditReport {
  const rows = auditDecisionMakingCategoryRecords(records)
    .sort((left, right) => left.stemId.localeCompare(right.stemId))
  return {
    schemaVersion: 1,
    summary: {
      totalStems: rows.length,
      activeStems: rows.filter((row) => row.stemLifecycle === 'active').length,
      stemDeletedStems: rows.filter((row) => row.stemLifecycle === 'stem_deleted').length,
      activeQuestions: rows.reduce(
        (total, row) => total + row.activeQuestionIds.length,
        0
      ),
      softDeletedQuestions: rows.reduce(
        (total, row) => total + row.softDeletedQuestionIds.length,
        0
      ),
      suggestedSyllogisms: rows.filter(
        (row) => row.suggestedCategory === 'Syllogisms'
      ).length,
      suggestedInterpretingInformation: rows.filter(
        (row) =>
          row.suggestedCategory ===
          'Interpreting Information and Drawing Conclusions'
      ).length,
      requiresHumanReview: rows.filter((row) => row.requiresHumanReview).length,
    },
    rows,
  }
}
