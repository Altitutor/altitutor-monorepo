import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { UcatSkillTrainerItemRow } from '@/features/ucat/skill-trainer/api/items'

export function skillTrainerItemContentSummary(item: UcatSkillTrainerItemRow): string {
  const content = item.content
  switch (item.trainer_key) {
    case 'find_word': {
      const passage = content.passage
      const text =
        passage && typeof passage === 'object'
          ? proseMirrorToPlainText(passage as Parameters<typeof proseMirrorToPlainText>[0])
          : ''
      const keywords = Array.isArray(content.keywords)
        ? content.keywords
            .map((k) => (k && typeof k === 'object' && 'text' in k ? String(k.text) : ''))
            .filter(Boolean)
        : []
      return keywords.length > 0 ? `${keywords.join(', ')}${text ? ` — ${text.slice(0, 80)}` : ''}` : text || 'No passage'
    }
    case 'find_concept': {
      const passage = content.passage
      const text =
        passage && typeof passage === 'object'
          ? proseMirrorToPlainText(passage as Parameters<typeof proseMirrorToPlainText>[0])
          : ''
      const concept = typeof content.concept === 'string' ? content.concept : ''
      return concept ? `${concept}${text ? ` — ${text.slice(0, 80)}` : ''}` : text || 'No content'
    }
    case 'quick_syllogism':
      return typeof content.statement === 'string' ? content.statement : 'Syllogism'
    case 'mental_maths':
      return typeof content.expression === 'string' ? content.expression : 'Math expression'
    case 'calculator_maths': {
      if (content.question && typeof content.question === 'object') {
        const text = proseMirrorToPlainText(
          content.question as Parameters<typeof proseMirrorToPlainText>[0]
        )
        if (text.trim()) return text.slice(0, 120)
      }
      return typeof content.expression === 'string' && content.expression.trim()
        ? content.expression
        : 'Calculator question'
    }
    case 'numpad_speed':
      return typeof content.label === 'string'
        ? content.label
        : Array.isArray(content.button_sequence)
          ? content.button_sequence.join(' ')
          : 'Numpad sequence'
    default:
      return JSON.stringify(content).slice(0, 120)
  }
}
