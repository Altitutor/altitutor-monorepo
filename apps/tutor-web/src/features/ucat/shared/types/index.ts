import type { Json, Tables } from '@altitutor/shared'

export type UcatSection = Tables<'vtutor_ucat_sections'>
export type UcatQuestionStem = Tables<'vtutor_ucat_question_stems'>
export type UcatQuestionSet = Tables<'vtutor_ucat_question_sets'>
export type UcatMock = Tables<'vtutor_ucat_mocks'>
export type UcatStudentProgress = Tables<'vtutor_ucat_student_progress_summary'>

export type RichTextJson = Json

export type UcatContentStatus = 'draft' | 'in_review' | 'published'
export type UcatAccessScope = 'public' | 'private'
export type UcatQuestionSetFormat = 'full_section' | 'partial_section'
export type UcatQuestionSetTimingMode = 'pace' | 'fixed' | 'untimed'

export const UCAT_CONTENT_STATUS_OPTIONS: Array<{ value: UcatContentStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'published', label: 'Published' },
]

export function getUcatContentStatusTransitionOptions(
  currentStatus: UcatContentStatus,
): Array<{ value: UcatContentStatus; label: string }> {
  if (currentStatus === 'draft') {
    return UCAT_CONTENT_STATUS_OPTIONS.filter((option) => option.value === 'in_review')
  }
  return UCAT_CONTENT_STATUS_OPTIONS.filter((option) => option.value !== currentStatus)
}

export type UcatPublicationIssue = {
  code: string
  message: string
}

export type UcatQuestionFormOption = {
  id?: string
  answerText: RichTextJson
  answerExplanation?: RichTextJson | null
  index: number
  answerKeyValue: 'correct' | 'yes' | 'no' | 'most' | 'least' | null
}

export type UcatQuestionFormItem = {
  id?: string
  index: number
  questionText: RichTextJson
  responseType: 'multiple_choice' | 'drag_and_drop'
  answerScheme: 'single_choice' | 'situational_judgement_rating' | 'decision_making_binary_placement' | 'situational_judgement_most_least'
  answerExplanation?: RichTextJson | null
  difficulty?: number | null
  timeBurdenSeconds?: number | null
  sourceChannel?: 'individual' | 'bulk_import' | 'ai_generation' | null
  aiGenerationMetadata?: Json | null
  options: UcatQuestionFormOption[]
  tagIds: string[]
}

export type UcatQuestionStemBundlePayload = {
  stemId?: string | null
  sectionId: string
  categoryId?: string | null
  stemText: RichTextJson
  accessScope: UcatAccessScope
  sourceChannel?: 'individual' | 'bulk_import' | 'ai_generation' | null
  tutorSourceNote?: string | null
  questions: UcatQuestionFormItem[]
}

export type UcatQuestionSetPayload = {
  id?: string | null
  authoringNote?: string | null
  description: string | RichTextJson
  timingMode: UcatQuestionSetTimingMode
  paceMultiplier?: number | null
  fixedTimeLimitSeconds?: number | null
  setFormat: UcatQuestionSetFormat
  accessScope: UcatAccessScope
  sectionId: string
  referenceBlueprintId: string
  stemIds: string[]
}

export type UcatMockPayload = {
  id?: string | null
  authoringNote?: string | null
  accessScope: UcatAccessScope
  instructionsText?: RichTextJson | null
  blueprintId: string
}
