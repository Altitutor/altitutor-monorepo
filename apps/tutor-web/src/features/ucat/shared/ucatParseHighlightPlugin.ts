import { Extension, type AnyExtension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node } from '@tiptap/pm/model'
import type { Json } from '@altitutor/shared'
import {
  bulkImportParserAcceptSyllogism,
  getBulkImportLogicalLines,
  type BulkImportParseSection,
} from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import { collectQuestionLineTextRanges } from '@/features/ucat/questions/lib/pmBulkImportLineRanges'
import {
  buildAnswerPasteSpansForLine,
  getAnswerLineRowKindsFromLines,
  type AnswerFieldSeparator,
} from '@/features/ucat/questions/lib/parseAnswersTable'
import {
  collectAnswerLineTextRanges,
  getAnswerDocPlainLinesFromJson,
  mapAnswerPasteSpanToDocRanges,
} from '@/features/ucat/questions/lib/pmAnswerLineRanges'
import {
  buildOptionRegexes,
  buildQuestionPasteSpansForLine,
  buildQuestionRegexes,
  classifyParseLineRoles,
  collectLogicalLinesFromDoc,
  type ParseLineHighlightRole,
  type ParserConfig,
} from '@/features/ucat/questions/lib/parsers/core'
import type { StemSplitDiscardLineSpan } from '@/features/ucat/questions/lib/parsers/splitStemDocument'
import { collectStemLogicalLineRanges } from '@/features/ucat/questions/lib/pmStemDocLineRanges'

/** Transaction meta key: refresh parse decorations (options / section changed). */
export const UCAT_PARSE_DECO_META = 'ucatParseDeco'

const ucatParseHighlightKey = new PluginKey<DecorationSet>('ucatBulkImportParse')

export type UcatParseHighlightConfig =
  | { mode: 'off' }
  | {
      mode: 'question'
      section: BulkImportParseSection
      classify: Pick<
        ParserConfig,
        | 'questionIndicator'
        | 'answerOptionIndicator'
        | 'questionNumberOnOwnLine'
        | 'answerOptionOnOwnLine'
        | 'enforceSequentialQuestionNumbers'
      >
      /** When true, classify lines like questions-only paste (per-stem editors). */
      questionsOnly?: boolean
    }
  | { mode: 'answer'; includeExplanations: boolean; fieldSeparator?: AnswerFieldSeparator }
  | {
      mode: 'stem_split'
      splitLineIndices: number[]
      discardedLineIndices: number[]
      discardedLineSpans: StemSplitDiscardLineSpan[]
    }

/** Classes live in globals.css (stable vs Tailwind / typography on generated spans). */

/** Split [from,to) into per-textblock {@link Decoration.inline} chunks (PM drops invalid spans). */
function pushPmInlineRangeDecorations(
  doc: Node,
  from: number,
  to: number,
  className: string,
  out: Decoration[]
): void {
  if (from >= to) return
  if (from < 0 || to > doc.content.size) return
  const attrs = { class: className }
  let pos = from
  let guard = 0
  const guardLimit = doc.content.size + 64
  while (pos < to && guard < guardLimit) {
    guard += 1
    const $ = doc.resolve(pos)
    if (!$.parent.isTextblock) {
      pos += 1
      continue
    }
    const blockStart = $.start()
    const blockEnd = $.end()
    const chunkFrom = Math.max(from, blockStart)
    const chunkTo = Math.min(to, blockEnd)
    if (chunkFrom < chunkTo) {
      out.push(Decoration.inline(chunkFrom, chunkTo, attrs))
    }
    if (chunkTo >= to) break
    const next = blockEnd + 1
    pos = next > pos ? next : pos + 1
  }
}

/** Question lines: optional full-node wrap for images; otherwise chunked inline. */
function addLineClassDecoration(
  doc: Node,
  from: number,
  to: number,
  className: string,
  out: Decoration[]
): void {
  if (from >= to) return
  if (from < 0 || to > doc.content.size) return
  const attrs = { class: className }

  const $start = doc.resolve(from)
  const nodeAfter = $start.nodeAfter
  if (
    nodeAfter &&
    nodeAfter.type.name === 'image' &&
    from + nodeAfter.nodeSize === to
  ) {
    out.push(Decoration.node(from, to, attrs))
    return
  }

  pushPmInlineRangeDecorations(doc, from, to, className, out)
}

function isImageNodeRange(doc: Node, from: number, to: number): boolean {
  if (from >= to || from < 0 || to > doc.content.size) return false
  const nodeAfter = doc.resolve(from).nodeAfter
  return !!nodeAfter && nodeAfter.type.name === 'image' && from + nodeAfter.nodeSize === to
}

function roleClassQuestion(role: ParseLineHighlightRole): string {
  switch (role) {
    case 'stem':
      return 'ucat-parse-hl-q-stem'
    case 'question':
      return 'ucat-parse-hl-q-question'
    case 'option':
      return 'ucat-parse-hl-q-option'
    default:
      return ''
  }
}

function resolveQuestionHighlightRole(
  docLineText: string,
  classifiedRole: ParseLineHighlightRole,
  classify: Pick<
    ParserConfig,
    'questionIndicator' | 'answerOptionIndicator' | 'questionNumberOnOwnLine' | 'answerOptionOnOwnLine'
  >
): ParseLineHighlightRole | null {
  if (classifiedRole === 'question' || classifiedRole === 'option') return classifiedRole

  const qRe = buildQuestionRegexes(classify.questionIndicator ?? 'dot')
  const oRe = buildOptionRegexes(classify.answerOptionIndicator ?? 'dot')
  if (oRe.inline.test(docLineText)) return 'option'
  if (qRe.inline.test(docLineText)) return 'question'
  return null
}

function buildQuestionDecorations(
  doc: Node,
  cfg: Extract<UcatParseHighlightConfig, { mode: 'question' }>
): DecorationSet {
  const j = doc.toJSON() as unknown as Json
  const questionsOnly = cfg.questionsOnly === true
  const lines = questionsOnly
    ? collectLogicalLinesFromDoc(j, {
        detectNestedQuestionTables: cfg.section !== 'quantitative_reasoning',
      })
    : getBulkImportLogicalLines(j, cfg.section, cfg.classify)
  if (lines.length === 0) return DecorationSet.empty
  const ranges = collectQuestionLineTextRanges(doc, cfg.section, { questionsOnly })
  if (ranges == null) return DecorationSet.empty
  const parserCfg = {
    ...cfg.classify,
    acceptSyllogismOptions: bulkImportParserAcceptSyllogism(cfg.section),
    questionsOnly: cfg.questionsOnly === true,
  }
  const roles = classifyParseLineRoles(lines, parserCfg)
  const decos: Decoration[] = []
  for (let i = 0; i < roles.length; i += 1) {
    const range = ranges[i]
    if (!range) continue
    const docLineText = doc.textBetween(range.from, range.to, undefined, '\n')
    const classifiedRole = roles[i] ?? 'none'
    if (classifiedRole === 'stem' && !questionsOnly) {
      addLineClassDecoration(doc, range.from, range.to, roleClassQuestion('stem'), decos)
      continue
    }
    const highlightRole = resolveQuestionHighlightRole(docLineText, classifiedRole, cfg.classify)
    if (!highlightRole) continue
    if (isImageNodeRange(doc, range.from, range.to)) {
      addLineClassDecoration(doc, range.from, range.to, roleClassQuestion(highlightRole), decos)
      continue
    }
    const spans = buildQuestionPasteSpansForLine(docLineText, highlightRole, cfg.classify)
    for (const sp of spans) {
      const from = range.from + sp.start
      const to = range.from + sp.end
      addLineClassDecoration(doc, from, to, roleClassQuestion(highlightRole), decos)
    }
  }
  return DecorationSet.create(doc, decos)
}

function kindClassAnswer(
  kind: 'questionNumber' | 'letter' | 'explanation' | 'header' | 'separator' | 'other',
  includeExplanations: boolean
): string {
  switch (kind) {
    case 'questionNumber':
      return 'ucat-parse-hl-a-qnum'
    case 'letter':
      return 'ucat-parse-hl-a-letter'
    case 'explanation':
      return includeExplanations ? 'ucat-parse-hl-a-expl' : 'ucat-parse-hl-a-expl-muted'
    case 'header':
      return 'ucat-parse-hl-a-header'
    case 'separator':
      return 'ucat-parse-hl-a-sep'
    default:
      return 'ucat-parse-hl-a-other'
  }
}

function buildAnswerDecorations(
  doc: Node,
  includeExplanations: boolean,
  fieldSeparator?: AnswerFieldSeparator
): DecorationSet {
  const answerParseOptions = fieldSeparator ? { fieldSeparator } : undefined
  const j = doc.toJSON() as unknown as Json
  const lineStrings = getAnswerDocPlainLinesFromJson(j)
  if (lineStrings.length === 0 || !lineStrings.some((l) => l.trim())) {
    return DecorationSet.empty
  }
  const ranges = collectAnswerLineTextRanges(doc)
  if (ranges == null) return DecorationSet.empty
  const lineKinds = getAnswerLineRowKindsFromLines(lineStrings, answerParseOptions)
  const decos: Decoration[] = []
  for (let i = 0; i < lineStrings.length; i += 1) {
    const row = lineKinds[i] ?? 'empty'
    if (row === 'empty') continue
    const line = lineStrings[i] ?? ''
    const R = ranges[i]
    if (!R) continue
    const spans = buildAnswerPasteSpansForLine(
      line,
      row === 'header' ? 'header' : 'data',
      answerParseOptions
    )
    for (const sp of spans) {
      const cls = kindClassAnswer(sp.kind, includeExplanations)
      const pieces = mapAnswerPasteSpanToDocRanges(R, line, sp)
      for (const { from: a, to: b } of pieces) {
        addLineClassDecoration(doc, a, b, cls, decos)
      }
    }
  }
  return DecorationSet.create(doc, decos)
}

type GetCfg = () => UcatParseHighlightConfig

function mapStemLineSpanToDocRange(
  lineRange: { from: number; to: number },
  line: string,
  span: { start: number; end: number }
): { from: number; to: number } | null {
  const ss = Math.max(0, span.start)
  const se = Math.min(line.length, span.end)
  if (ss >= se) return null
  const from = lineRange.from + ss
  const to = lineRange.from + se
  if (from >= to) return null
  return { from, to }
}

function buildStemSplitDecorations(
  doc: Node,
  cfg: Extract<UcatParseHighlightConfig, { mode: 'stem_split' }>
): DecorationSet {
  const ranges = collectStemLogicalLineRanges(doc)
  if (ranges == null || ranges.length === 0) return DecorationSet.empty

  const j = doc.toJSON() as unknown as Json
  const lines = collectLogicalLinesFromDoc(j, {
    detectNestedQuestionTables: false,
    preserveBlankLines: true,
  })

  const decos: Decoration[] = []
  const fullLineDiscard = new Set(cfg.discardedLineIndices)

  for (const lineIndex of cfg.discardedLineIndices) {
    const R = ranges[lineIndex]
    if (!R) continue
    addLineClassDecoration(doc, R.from, R.to, 'ucat-parse-hl-discard', decos)
  }

  for (const span of cfg.discardedLineSpans) {
    if (fullLineDiscard.has(span.lineIndex)) continue
    const R = ranges[span.lineIndex]
    const line = lines[span.lineIndex] ?? ''
    if (!R) continue
    const mapped = mapStemLineSpanToDocRange(R, line, span)
    if (!mapped) continue
    addLineClassDecoration(doc, mapped.from, mapped.to, 'ucat-parse-hl-discard', decos)
  }

  for (const lineIndex of cfg.splitLineIndices) {
    const R = ranges[lineIndex]
    if (!R) continue
    decos.push(
      Decoration.widget(
        R.from,
        () => {
          const line = document.createElement('div')
          line.className = 'ucat-parse-stem-split-line'
          line.setAttribute('aria-hidden', 'true')
          return line
        },
        { side: -1, key: `stem-split-${lineIndex}` }
      )
    )
  }
  return DecorationSet.create(doc, decos)
}

function buildDecorationsSet(doc: Node, getConfig: GetCfg): DecorationSet {
  const c = getConfig()
  if (c.mode === 'off') return DecorationSet.empty
  if (c.mode === 'question') {
    return buildQuestionDecorations(doc, c)
  }
  if (c.mode === 'stem_split') {
    return buildStemSplitDecorations(doc, c)
  }
  return buildAnswerDecorations(doc, c.includeExplanations, c.fieldSeparator)
}

/**
 * In-editor parse highlights for bulk import (question doc or answers doc, not both).
 * Keep the latest config in a ref and dispatch a transaction with {@link UCAT_PARSE_DECO_META}
 * when only parser options (not the document) change.
 */
export function createUcatParseHighlight(getConfig: GetCfg): AnyExtension {
  return Extension.create({
    name: 'ucatParseHighlight',

    addProseMirrorPlugins() {
      const getCfg: GetCfg = getConfig
      return [
        new Plugin<DecorationSet>({
          key: ucatParseHighlightKey,
          state: {
            init(_, { doc }): DecorationSet {
              return buildDecorationsSet(doc, getCfg)
            },
            apply(
              tr,
              value,
              _o,
              newState
            ): DecorationSet {
              if (!tr.docChanged && tr.getMeta(UCAT_PARSE_DECO_META) == null) {
                return value
              }
              return buildDecorationsSet(newState.doc, getCfg)
            },
          },
          props: {
            decorations(state) {
              return ucatParseHighlightKey.getState(state) ?? null
            },
          },
        }),
      ]
    },
  })
}
