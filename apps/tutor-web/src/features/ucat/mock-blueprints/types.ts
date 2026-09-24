import type { BlueprintAnswerScheme, BlueprintSectionCode } from '@altitutor/ucat-blueprint'

export type MockBlueprintCategoryRule = {
  categoryId?: string
  category?: string
  answerScheme?: BlueprintAnswerScheme
  requiredAnswerScheme?: BlueprintAnswerScheme
  label?: string
  unit: 'questions' | 'stems'
  min: number
  preferred?: number
  max: number
}

export type MockBlueprintSectionPayload = {
  section: BlueprintSectionCode
  sectionIndex: number
  exactQuestionCount: number
  answeringTimeSeconds: number
  instructionTimeSeconds: number
  categoryRules: MockBlueprintCategoryRule[]
}

export type MockBlueprintPayload = {
  sourceBlueprintId?: string | null
  testYear: number
  officialFactsLabel: string
  altitutorPolicyLabel: string
  sections: MockBlueprintSectionPayload[]
}

export type MockBlueprintRow = {
  id: string
  code: string
  test_year: number
  version: number
  official_facts_label: string
  altitutor_policy_label: string
  created_at: string | null
  sections: unknown
}

