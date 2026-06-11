export type UcatQuestionStemCategoryRow = {
  id: string
  name: string
  section_id: string | null
  section_name: string
  parent_id: string | null
  description: string
  question_stem_count: number
}

export type UcatQuestionStemCategoryTreeNode = {
  id: string
  name: string
  description: string
  parent_id: string | null
  question_stem_count: number
  child_count: number
  children: UcatQuestionStemCategoryTreeNode[]
}

export type UcatQuestionStemCategoryDraft = {
  name: string
  sectionId: string
  parentCategoryId: string
  description: string
}

export type UcatCategoryLinkedStem = {
  stemId: string
  stemText: unknown
  sectionName: string
}
