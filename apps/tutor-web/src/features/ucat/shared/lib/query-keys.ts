export const ucatKeys = {
  all: ['ucat'] as const,
  access: () => [...ucatKeys.all, 'access'] as const,
  sections: () => [...ucatKeys.all, 'sections'] as const,
  categories: () => [...ucatKeys.all, 'categories'] as const,
  categoryStems: (categoryId: string) => [...ucatKeys.categories(), categoryId, 'stems'] as const,
  tags: () => [...ucatKeys.all, 'tags'] as const,
  tagQuestions: (tagId: string) => [...ucatKeys.tags(), tagId, 'questions'] as const,
  questions: (mode: 'default' | 'generated' | 'all' = 'default') =>
    [...ucatKeys.all, 'questions', mode] as const,
  question: (id: string) => [...ucatKeys.all, 'question', id] as const,
  aiAssessment: (stemId: string) => [...ucatKeys.question(stemId), 'ai-assessment'] as const,
  questionStemTypes: () => [...ucatKeys.questions('all'), 'stem-types'] as const,
  questionStemTagIds: () => [...ucatKeys.questions('all'), 'stem-tag-ids'] as const,
  /** Shared index for types + tag ids + question/answer search texts (one detail fetch). */
  questionStemListIndex: () => [...ucatKeys.questions('all'), 'stem-list-index'] as const,
  stemCatalog: () => [...ucatKeys.questions('all'), 'stem-catalog'] as const,
  questionCatalog: () => [...ucatKeys.questions('all'), 'question-catalog'] as const,
  questionCatalogPage: (query: object) =>
    [...ucatKeys.questions('all'), 'catalog-page', query] as const,
  questionCatalogCreators: () =>
    [...ucatKeys.questions('all'), 'catalog-creators'] as const,
  sets: () => [...ucatKeys.all, 'sets'] as const,
  set: (id: string) => [...ucatKeys.sets(), id] as const,
  mocks: () => [...ucatKeys.all, 'mocks'] as const,
  mock: (id: string) => [...ucatKeys.mocks(), id] as const,
  students: () => [...ucatKeys.all, 'students'] as const,
  student: (id: string) => [...ucatKeys.students(), id] as const,
  classes: () => [...ucatKeys.all, 'classes'] as const,
  classSessions: (classId: string) => [...ucatKeys.classes(), classId, 'sessions'] as const,
  sessionResources: (sessionId: string) => [...ucatKeys.classes(), 'session', sessionId, 'resources'] as const,
  reconciliation: () => [...ucatKeys.all, 'reconciliation'] as const,
  reconciliationQueue: (kind: string, query?: object) =>
    [...ucatKeys.reconciliation(), 'queue', kind, ...(query ? [query] : [])] as const,
  learningModules: (kind?: string, status?: string, includeDeleted?: boolean) =>
    [...ucatKeys.all, 'learning-modules', kind ?? 'all', status ?? 'any', includeDeleted ? 'deleted' : 'active'] as const,
  learningModule: (id: string) => [...ucatKeys.all, 'learning-module', id] as const,
  learningModuleBlocks: (moduleId: string) => [...ucatKeys.learningModule(moduleId), 'blocks'] as const,
  skillTrainers: () => [...ucatKeys.all, 'skill-trainers'] as const,
  skillTrainerItems: (trainerKey?: string, approvalStatus?: string) =>
    [...ucatKeys.all, 'skill-trainer-items', trainerKey ?? 'all', approvalStatus ?? 'all'] as const,
  skillTrainerItem: (id: string) => [...ucatKeys.all, 'skill-trainer-item', id] as const,
}
