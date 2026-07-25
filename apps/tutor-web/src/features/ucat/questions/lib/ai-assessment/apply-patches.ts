import type { Json } from '@altitutor/shared'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatAssessmentPatch } from './schema'
import { aiTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'

type MutableRecord = Record<string, unknown>

function isRecord(value: unknown): value is MutableRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right))
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function replaceExactText(value: Json | null | undefined, beforeText: string, afterText: string): Json {
  const clone = cloneJson(value ?? { type: 'doc', content: [] }) as unknown
  const textNodes: MutableRecord[] = []
  let matches = 0
  function count(node: unknown) {
    if (Array.isArray(node)) return node.forEach(count)
    if (!isRecord(node)) return
    if (node.type === 'text' && typeof node.text === 'string') {
      textNodes.push(node)
      let cursor = 0
      while ((cursor = node.text.indexOf(beforeText, cursor)) >= 0) {
        matches += 1
        cursor += beforeText.length
      }
    }
    Object.values(node).forEach(count)
  }
  count(clone)
  if (matches === 0) {
    const joined = textNodes.map((node) => String(node.text ?? '')).join('')
    const firstMatch = joined.indexOf(beforeText)
    const secondMatch = firstMatch >= 0 ? joined.indexOf(beforeText, firstMatch + beforeText.length) : -1
    if (firstMatch >= 0 && secondMatch < 0) {
      let cursor = 0
      const touched = textNodes.flatMap((node) => {
        const text = String(node.text ?? '')
        const start = Math.max(firstMatch, cursor)
        const end = Math.min(firstMatch + beforeText.length, cursor + text.length)
        const result = end > start
          ? [{ node, text, start: start - cursor, end: end - cursor }]
          : []
        cursor += text.length
        return result
      })
      if (touched.length === 2) {
        const [first, last] = touched
        const firstAffected = first.text.slice(first.start, first.end)
        const lastAffected = last.text.slice(last.start, last.end)
        if (afterText.startsWith(firstAffected)) {
          first.node.text = first.text.slice(0, first.start) + firstAffected + first.text.slice(first.end)
          last.node.text = last.text.slice(0, last.start) + afterText.slice(firstAffected.length).trimStart() + last.text.slice(last.end)
          return clone as Json
        }
        if (afterText.endsWith(lastAffected)) {
          first.node.text = first.text.slice(0, first.start) + afterText.slice(0, -lastAffected.length).trimEnd()
          last.node.text = last.text.slice(0, last.start) + lastAffected + last.text.slice(last.end)
          return clone as Json
        }
      }
    }
  }
  if (matches !== 1) {
    throw new Error(matches === 0
      ? 'The suggested source text no longer exactly matches the draft.'
      : 'The suggested source text occurs more than once, so it cannot be changed safely.')
  }
  function replace(node: unknown) {
    if (Array.isArray(node)) return node.forEach(replace)
    if (!isRecord(node)) return
    if (node.type === 'text' && typeof node.text === 'string' && node.text.includes(beforeText)) {
      node.text = node.text.replace(beforeText, afterText)
      return
    }
    Object.values(node).forEach(replace)
  }
  replace(clone)
  return clone as Json
}

function questionIndex(values: UcatQuestionStemFormValues, id: string) {
  const index = values.questions.findIndex((question) => question.id === id)
  if (index < 0) throw new Error('The suggested question no longer exists in the draft.')
  return index
}

function optionLocation(values: UcatQuestionStemFormValues, id: string) {
  for (let qIndex = 0; qIndex < values.questions.length; qIndex += 1) {
    const optionIndex = values.questions[qIndex]?.options.findIndex((option) => option.id === id) ?? -1
    if (optionIndex >= 0) return { questionIndex: qIndex, optionIndex }
  }
  throw new Error('The suggested answer option no longer exists in the draft.')
}

/** Coerce form/DOM/model values so metadata accept is not blocked by string/number drift. */
function normalizeDifficulty(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Accept seconds number, numeric string, or mm:ss from form / model before/after. */
function normalizeTimeBurdenSeconds(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return parseTimeToSeconds(value)
  return null
}

function normalizeMetadataExpectation(
  field: Extract<UcatAssessmentPatch, { operation: 'set_metadata' }>['field'],
  value: unknown,
) {
  if (field === 'difficulty') return normalizeDifficulty(value)
  if (field === 'time_burden_seconds') return normalizeTimeBurdenSeconds(value)
  return value
}

function metadataValue(
  values: UcatQuestionStemFormValues,
  patch: Extract<UcatAssessmentPatch, { operation: 'set_metadata' }>,
) {
  if (patch.targetKind === 'stem') {
    if (patch.field === 'section_id') return values.sectionId
    if (patch.field === 'category_id') return values.categoryId ?? null
    throw new Error('The suggested stem metadata field is invalid.')
  }
  const question = values.questions[questionIndex(values, patch.targetId)]
  if (patch.field === 'difficulty') return normalizeDifficulty(question.difficulty)
  if (patch.field === 'time_burden_seconds') return normalizeTimeBurdenSeconds(question.timeBurdenSeconds)
  if (patch.field === 'tag_ids') return question.tagIds
  if (patch.field === 'question_type') return question.questionType
  throw new Error('The suggested question metadata field is invalid.')
}

function getTextTarget(values: UcatQuestionStemFormValues, patch: Extract<UcatAssessmentPatch, { operation: 'replace_text' | 'update_visual_spec' }>) {
  const { target } = patch
  if (target.kind === 'stem') {
    if (target.field !== 'stem_text') throw new Error('The suggested stem field is invalid.')
    return {
      get: () => values.stemText,
      set: (next: Json) => { values.stemText = next },
    }
  }
  if (!target.id) throw new Error('The suggestion is missing a target ID.')
  if (target.kind === 'question') {
    const index = questionIndex(values, target.id)
    if (target.field === 'question_text') {
      return {
        get: () => values.questions[index].questionText,
        set: (next: Json) => { values.questions[index].questionText = next },
      }
    }
    if (target.field === 'answer_explanation') {
      return {
        get: () => values.questions[index].answerExplanation ?? null,
        set: (next: Json) => { values.questions[index].answerExplanation = next },
      }
    }
    throw new Error('The suggested question field is invalid.')
  }
  const location = optionLocation(values, target.id)
  const option = values.questions[location.questionIndex].options[location.optionIndex]
  if (target.field === 'answer_text') {
    return {
      get: () => option.answerText,
      set: (next: Json) => { option.answerText = next },
    }
  }
  if (target.field === 'answer_explanation') {
    return {
      get: () => option.answerExplanation ?? null,
      set: (next: Json) => { option.answerExplanation = next },
    }
  }
  throw new Error('The suggested answer-option field is invalid.')
}

function findImage(value: Json | null | undefined, imageIndex: number): MutableRecord | null {
  let seen = -1
  let found: MutableRecord | null = null
  function walk(node: unknown) {
    if (found) return
    if (Array.isArray(node)) return node.forEach(walk)
    if (!isRecord(node)) return
    if (node.type === 'image') {
      seen += 1
      if (seen === imageIndex) {
        found = node
        return
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(value)
  return found
}

async function renderVisualPatch(
  value: Json | null | undefined,
  patch: Extract<UcatAssessmentPatch, { operation: 'update_visual_spec' }>,
  renderVisual?: (input: {
    visualType: 'venn_diagram' | 'set_diagram' | 'vega_lite_chart'
    title: string | null
    altText: string
    spec: Record<string, unknown>
  }) => Promise<Json>,
) {
  const clone = cloneJson(value ?? { type: 'doc', content: [] }) as Json
  const existing = findImage(clone, patch.imageIndex)
  if (!existing) throw new Error('The suggested visual no longer exists in the draft.')
  const attrs = isRecord(existing.attrs) ? existing.attrs : {}
  if (!sameJson(attrs.visualSpec, patch.beforeSpec)) {
    throw new Error('The visual specification has changed since this suggestion was created.')
  }
  const visualInput = {
    visualType: patch.visualType,
    title: patch.title ?? (typeof attrs.visualTitle === 'string' ? attrs.visualTitle : null),
    altText: patch.altText ?? (typeof attrs.visualAltText === 'string' ? attrs.visualAltText : ''),
    spec: patch.afterSpec,
  }
  let imageNode: Json
  if (renderVisual) {
    imageNode = await renderVisual(visualInput)
  } else {
    const response = await fetch('/api/ucat/authoring-agent/visuals/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'visual', ...visualInput }),
    })
    const body = await response.json().catch(() => ({})) as { imageNode?: Json; error?: string }
    if (!response.ok || !body.imageNode || !isRecord(body.imageNode)) {
      throw new Error(body.error ?? 'The updated visual could not be rendered.')
    }
    imageNode = body.imageNode
  }
  if (!isRecord(imageNode)) throw new Error('The updated visual could not be rendered.')
  Object.keys(existing).forEach((key) => delete existing[key])
  Object.assign(existing, imageNode)
  return clone
}

export async function applyUcatAssessmentPatches(
  current: UcatQuestionStemFormValues,
  patches: UcatAssessmentPatch[],
  options?: {
    renderVisual?: Parameters<typeof renderVisualPatch>[2]
  },
) {
  const values = cloneJson(current)
  for (const patch of patches) {
    switch (patch.operation) {
      case 'replace_text': {
        const target = getTextTarget(values, patch)
        target.set(replaceExactText(target.get(), patch.beforeText, patch.afterText))
        break
      }
      case 'set_answer_key': {
        const index = questionIndex(values, patch.questionId)
        const currentCorrectOptionId = values.questions[index].options.find((option) => option.isAnswer)?.id ?? null
        if (currentCorrectOptionId !== patch.currentCorrectOptionId) {
          throw new Error('The keyed answer has changed since this suggestion was created.')
        }
        if (!values.questions[index].options.some((option) => option.id === patch.correctOptionId)) {
          throw new Error('The suggested correct answer no longer exists in the draft.')
        }
        values.questions[index].options.forEach((option) => {
          option.isAnswer = option.id === patch.correctOptionId
        })
        break
      }
      case 'replace_option_and_key': {
        const index = questionIndex(values, patch.questionId)
        const option = values.questions[index].options.find((candidate) => candidate.id === patch.optionId)
        if (!option) throw new Error('The answer option selected for replacement no longer exists.')
        if (proseMirrorToPlainText(option.answerText).trim() !== patch.beforeAnswerText.trim()) {
          throw new Error('The answer option text has changed since this suggestion was created.')
        }
        option.answerText = aiTextToProseMirror(patch.answerText)
        if (patch.answerExplanation !== undefined) {
          option.answerExplanation = patch.answerExplanation ? aiTextToProseMirror(patch.answerExplanation) : null
        }
        values.questions[index].options.forEach((candidate) => {
          candidate.isAnswer = candidate.id === patch.optionId
        })
        break
      }
      case 'set_metadata': {
        const expectedBefore = normalizeMetadataExpectation(patch.field, patch.before)
        if (!sameJson(metadataValue(values, patch), expectedBefore)) {
          throw new Error('The metadata has changed since this suggestion was created.')
        }
        if (patch.targetKind === 'stem') {
          if (patch.field === 'section_id' && typeof patch.after === 'string') values.sectionId = patch.after
          else if (patch.field === 'category_id' && (typeof patch.after === 'string' || patch.after === null)) values.categoryId = patch.after
          else throw new Error('The suggested stem metadata change is invalid.')
          break
        }
        const index = questionIndex(values, patch.targetId)
        const question = values.questions[index]
        if (patch.field === 'difficulty') {
          const nextDifficulty = normalizeDifficulty(patch.after)
          if (patch.after != null && patch.after !== '' && nextDifficulty == null) {
            throw new Error('The suggested difficulty value is invalid.')
          }
          question.difficulty = nextDifficulty
        } else if (patch.field === 'time_burden_seconds') {
          const nextSeconds = normalizeTimeBurdenSeconds(patch.after)
          if (patch.after != null && patch.after !== '' && nextSeconds == null) {
            throw new Error('The suggested time burden value is invalid.')
          }
          question.timeBurdenSeconds = secondsToTimeString(nextSeconds)
        } else if (patch.field === 'tag_ids' && Array.isArray(patch.after) && patch.after.every((id) => typeof id === 'string')) {
          question.tagIds = patch.after
        } else if (patch.field === 'question_type' && (patch.after === 'multiple_choice' || patch.after === 'syllogism')) {
          question.questionType = patch.after
        } else throw new Error('The suggested question metadata change is invalid.')
        break
      }
      case 'update_visual_spec': {
        const target = getTextTarget(values, patch)
        target.set(await renderVisualPatch(target.get(), patch, options?.renderVisual))
        break
      }
    }
  }
  return values
}
