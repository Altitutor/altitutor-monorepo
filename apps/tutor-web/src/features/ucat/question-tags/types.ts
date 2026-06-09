export type UcatQuestionTagRow = {
  id: string
  name: string
  parent_id: string | null
  section_id: string | null
  description: string
  question_count: number
}

export type UcatQuestionTagTreeNode = {
  id: string
  name: string
  description: string
  parent_id: string | null
  question_count: number
  child_count: number
  children: UcatQuestionTagTreeNode[]
}

export type UcatQuestionTagDraft = {
  name: string
  parentTagId: string
  sectionId: string
  description: string
}

export type UcatTagLinkedQuestion = {
  questionId: string
  questionIndex: number
  questionText: unknown
  stemId: string
  sectionName: string
}
