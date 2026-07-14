import type { Json, Tables } from '@altitutor/shared'

export type UcatSection = Tables<'vtutor_ucat_sections'>
export type UcatQuestionStem = Tables<'vtutor_ucat_question_stems'>
export type UcatQuestionSet = Tables<'vtutor_ucat_question_sets'>
export type UcatMock = Tables<'vtutor_ucat_mocks'>
export type UcatStudentProgress = Tables<'vtutor_ucat_student_progress_summary'>

export type RichTextJson = Json

export type UcatContentStatus = 'draft' | 'in_review' | 'published'
export type UcatAccessScope = 'public' | 'private'

export type UcatPublicationIssue = {
  code: string
  message: string
}

export type UcatQuestionFormOption = {
  id?: string
  answerText: RichTextJson
  answerExplanation?: RichTextJson | null
  index: number
  isAnswer: boolean
}

export type UcatQuestionFormItem = {
  id?: string
  index: number
  questionText: RichTextJson
  questionType: 'multiple_choice' | 'syllogism'
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
  name?: RichTextJson | null
  description: string | RichTextJson
  timeLimitSeconds?: number | null
  accessScope: UcatAccessScope
  stemIds: string[]
}

export type UcatMockPayload = {
  id?: string | null
  name: string
  accessScope: UcatAccessScope
  setIds: string[]
  instructionsText?: RichTextJson | null
}
