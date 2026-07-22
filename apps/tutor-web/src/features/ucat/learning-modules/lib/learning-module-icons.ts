export const LEARNING_MODULE_ICON_OPTIONS = [
  { value: 'book-open', label: 'Book' },
  { value: 'lightbulb', label: 'Idea' },
  { value: 'target', label: 'Target' },
  { value: 'brain', label: 'Brain' },
  { value: 'calculator', label: 'Calculator' },
  { value: 'compass', label: 'Compass' },
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'file-text', label: 'Document' },
] as const

export type LearningModuleIconKey = (typeof LEARNING_MODULE_ICON_OPTIONS)[number]['value']

export function isLearningModuleIconKey(value: unknown): value is LearningModuleIconKey {
  return LEARNING_MODULE_ICON_OPTIONS.some((option) => option.value === value)
}
