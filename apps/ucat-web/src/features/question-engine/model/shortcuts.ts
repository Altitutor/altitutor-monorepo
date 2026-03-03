export type QuestionEngineShortcutId =
  | 'toggleCalculator'
  | 'toggleFlagForReview'
  | 'previousQuestion'
  | 'openNavigator'
  | 'nextQuestion'
  | 'reviewScreen'

export type QuestionEngineShortcut = {
  id: QuestionEngineShortcutId
  key: string
  altKey?: boolean
}

export const QUESTION_ENGINE_SHORTCUTS: QuestionEngineShortcut[] = [
  { id: 'toggleCalculator', key: 'c', altKey: true },
  { id: 'toggleFlagForReview', key: 'f', altKey: true },
  { id: 'previousQuestion', key: 'p', altKey: true },
  { id: 'openNavigator', key: 'v', altKey: true },
  { id: 'nextQuestion', key: 'n', altKey: true },
  { id: 'reviewScreen', key: 's', altKey: true },
]

export const QUESTION_ENGINE_SHORTCUT_MAP: Record<string, QuestionEngineShortcutId> =
  QUESTION_ENGINE_SHORTCUTS.reduce((acc, shortcut) => {
    const parts = []
    if (shortcut.altKey) parts.push('alt')
    parts.push(shortcut.key.toLowerCase())
    const key = parts.join('+')
    acc[key] = shortcut.id
    return acc
  }, {} as Record<string, QuestionEngineShortcutId>)

