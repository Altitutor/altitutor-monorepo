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
} from '@/features/ucat/questions/lib/parseAnswersTable'
import {
  collectAnswerLineTextRanges,
  getAnswerDocPlainLinesFromJson,
  mapAnswerPasteSpanToDocRanges,
} from '@/features/ucat/questions/lib/pmAnswerLineRanges'
import {
  classifyParseLineRoles,
  type ParseLineHighlightRole,
  type ParserConfig,
} from '@/features/ucat/questions/lib/parsers/core'

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
        'questionIndicator' | 'answerOptionIndicator' | 'questionNumberOnOwnLine' | 'answerOptionOnOwnLine'
      >
    }
  | { mode: 'answer'; includeExplanations: boolean }

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

function buildQuestionDecorations(
  doc: Node,
  cfg: Extract<UcatParseHighlightConfig, { mode: 'question' }>
): DecorationSet {
  const j = doc.toJSON() as unknown as Json
  const lines = getBulkImportLogicalLines(j, cfg.section)
  if (lines.length === 0) return DecorationSet.empty
  const ranges = collectQuestionLineTextRanges(doc, cfg.section)
  if (ranges == null) return DecorationSet.empty
  const roles = classifyParseLineRoles(lines, {
    ...cfg.classify,
    acceptSyllogismOptions: bulkImportParserAcceptSyllogism(cfg.section),
  })
  const decos: Decoration[] = []
  for (let i = 0; i < roles.length; i += 1) {
    const role = roles[i] ?? 'none'
    if (role === 'none') continue
    const range = ranges[i]
    if (!range) continue
    addLineClassDecoration(doc, range.from, range.to, roleClassQuestion(role), decos)
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
  includeExplanations: boolean
): DecorationSet {
  const j = doc.toJSON() as unknown as Json
  const lineStrings = getAnswerDocPlainLinesFromJson(j)
  if (lineStrings.length === 0 || !lineStrings.some((l) => l.trim())) {
    return DecorationSet.empty
  }
  const ranges = collectAnswerLineTextRanges(doc)
  if (ranges == null) return DecorationSet.empty
  const lineKinds = getAnswerLineRowKindsFromLines(lineStrings)
  const decos: Decoration[] = []
  for (let i = 0; i < lineStrings.length; i += 1) {
    const row = lineKinds[i] ?? 'empty'
    if (row === 'empty') continue
    const line = lineStrings[i] ?? ''
    const R = ranges[i]
    if (!R) continue
    const spans = buildAnswerPasteSpansForLine(
      line,
      row === 'header' ? 'header' : 'data'
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

function buildDecorationsSet(doc: Node, getConfig: GetCfg): DecorationSet {
  const c = getConfig()
  if (c.mode === 'off') return DecorationSet.empty
  if (c.mode === 'question') {
    return buildQuestionDecorations(doc, c)
  }
  return buildAnswerDecorations(doc, c.includeExplanations)
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
