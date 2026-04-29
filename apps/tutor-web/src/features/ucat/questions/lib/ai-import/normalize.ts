import type { Json } from '@altitutor/shared'
import {
  tokenizedPlainTextToProseMirrorWithLineBreaks,
  plainTextToProseMirror,
} from '@/features/ucat/shared/lib/rich-text'
import type {
  AiImportDraftStemPayload,
  AiImportExtractResponse,
} from '@/features/ucat/questions/lib/ai-import/schema'

type NormalizeArgs = {
  sectionId: string
  model: string
  extraction: AiImportExtractResponse
}

export function normalizeAiExtractionToDrafts(args: NormalizeArgs): AiImportDraftStemPayload[] {
  const importedAt = new Date().toISOString()
  const stems = args.extraction.stems

  return stems.map((stem, stemIndex) => {
    const stemIssues = stem.issues ?? []
    const questionIssueCount = stem.questions.reduce((sum, question) => sum + question.issues.length, 0)
    return {
      sectionId: args.sectionId,
      categoryId: null,
      stemText: tokenizedPlainTextToProseMirrorWithLineBreaks(stem.stemText),
      isPrivate: true,
      questions: stem.questions.map((question, questionIndex) => {
        const resolvedCorrectIndex = question.options.findIndex((option) => option.isAnswer)
        const optionFallbackIndex = resolvedCorrectIndex >= 0 ? resolvedCorrectIndex : 0
        return {
          index: questionIndex + 1,
          questionText: tokenizedPlainTextToProseMirrorWithLineBreaks(question.questionText),
          answerExplanation: question.answerExplanation
            ? tokenizedPlainTextToProseMirrorWithLineBreaks(question.answerExplanation)
            : null,
          difficulty: null,
          timeBurdenSeconds: null,
          questionType: question.questionType,
          tagIds: [],
          options: question.options.map((option, optionIndex) => ({
            index: optionIndex + 1,
            answerText: tokenizedPlainTextToProseMirrorWithLineBreaks(option.answerText),
            answerExplanation: option.answerExplanation
              ? tokenizedPlainTextToProseMirrorWithLineBreaks(option.answerExplanation)
              : null,
            isAnswer: resolvedCorrectIndex >= 0 ? option.isAnswer : optionIndex === optionFallbackIndex,
          })),
        }
      }),
      aiGenerationMetadata: {
        source: 'ai_import',
        importedAt,
        model: args.model,
        extractionStatus: args.extraction.status,
        stemIndex,
        stemIssueCount: stemIssues.length,
        questionIssueCount,
        sourceSummary: args.extraction.sourceSummary,
        stemIssues,
        globalIssues: args.extraction.globalIssues,
        questionDiagnostics: stem.questions.map((question, questionIndex) => ({
          questionIndex: questionIndex + 1,
          confidence: question.confidence,
          imageDependent: question.imageDependent,
          issues: question.issues,
          qcSkippedReasons: question.qcSkippedReasons,
          sourceEvidence: question.sourceEvidence,
        })),
      } satisfies Json,
    }
  })
}

export function appendAiIssueMetadata(
  stems: AiImportDraftStemPayload[],
  metadataPatch: Record<string, unknown>
): AiImportDraftStemPayload[] {
  return stems.map((stem) => ({
    ...stem,
    aiGenerationMetadata: {
      ...(typeof stem.aiGenerationMetadata === 'object' && stem.aiGenerationMetadata != null
        ? (stem.aiGenerationMetadata as Record<string, unknown>)
        : {}),
      ...metadataPatch,
    },
  }))
}

export function toQuestionLevelExplanation(text: string | null | undefined): Json | null {
  if (!text || !text.trim()) return null
  return plainTextToProseMirror(text.trim())
}
