import sharp from 'sharp'
import { mathjax } from '@mathjax/src/js/mathjax.js'
import { TeX } from '@mathjax/src/js/input/tex.js'
import { SVG } from '@mathjax/src/js/output/svg.js'
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js'
import { MathJaxTexFont } from '@mathjax/mathjax-tex-font/js/svg.js'
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js'
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js'
import type { LiteElement } from '@mathjax/src/js/adaptors/lite/Element.js'
import type { LiteText } from '@mathjax/src/js/adaptors/lite/Text.js'
import type { LiteDocument } from '@mathjax/src/js/adaptors/lite/Document.js'
import type { Json } from '@altitutor/shared'
import type { UcatPdfStem } from './UcatQuestionExportDocument'

type RichNode = Record<string, unknown>
const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

/** Typeset saved math without network/font loading or changing authored JSON.
 * A fresh input jax per export prevents TeX macro definitions leaking between
 * users. Invalid/unsupported expressions retain their source for the renderer's
 * labelled fallback. The cache lives only for this export.
 */
export async function preparePdfMath(stems: UcatPdfStem[]): Promise<UcatPdfStem[]> {
  const document = mathjax.document('', {
    InputJax: new TeX<LiteElement, LiteText, LiteDocument>({
      packages: ['base', 'ams', 'newcommand'], maxBuffer: 8192, maxMacros: 1000,
      formatError: (_jax: unknown, error: Error) => { throw error },
    }),
    OutputJax: new SVG<LiteElement, LiteText, LiteDocument>({
      fontData: MathJaxTexFont, fontCache: 'none', linebreaks: { inline: false },
    }),
  })
  const cache = new Map<string, Promise<RichNode>>()
  async function typeset(latex: string, display: boolean): Promise<RichNode> {
    if (!latex.trim() || latex.length > 4000) return {}
    try {
      const node = document.convert(latex, { display, em: 10, ex: 5, containerWidth: 490 }) as LiteElement
      const svg = adaptor.tags(node, 'svg')[0]
      if (!svg || adaptor.tags(node, 'merror').length) return {}
      const bounds = String(adaptor.getAttribute(svg, 'viewBox')).split(/\s+/u).map(Number)
      const width = bounds[2] / 1000
      const height = bounds[3] / 1000
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 100 || height > 30) return {}
      // MathJax's glyph paths use 1000 units per em. Explicit pixel dimensions
      // give Sharp a deterministic 3x raster, independent of SVG ex/font metrics.
      adaptor.setAttribute(svg, 'width', String(Math.ceil(width * 30)))
      adaptor.setAttribute(svg, 'height', String(Math.ceil(height * 30)))
      const png = await sharp(Buffer.from(adaptor.outerHTML(svg)), { limitInputPixels: 4_000_000 })
        .png().toBuffer()
      return { pdfMathSrc: `data:image/png;base64,${png.toString('base64')}`, pdfMathWidth: width, pdfMathHeight: height }
    } catch {
      return {}
    }
  }
  async function walk(value: Json | null): Promise<Json | null> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    const node = value as RichNode
    const attrs = node.attrs && typeof node.attrs === 'object' ? node.attrs as RichNode : {}
    let mathAttrs: RichNode = {}
    if ((node.type === 'inlineMath' || node.type === 'blockMath') && typeof attrs.latex === 'string') {
      const display = node.type === 'blockMath'
      const key = JSON.stringify([display, attrs.latex])
      let pending = cache.get(key)
      if (!pending) { pending = typeset(attrs.latex, display); cache.set(key, pending) }
      mathAttrs = await pending
    }
    // Discard authored pdfMath* attributes: only this server may supply images.
    const sourceAttrs = { ...attrs }
    delete sourceAttrs.pdfMathSrc
    delete sourceAttrs.pdfMathWidth
    delete sourceAttrs.pdfMathHeight
    return {
      ...node,
      ...(node.attrs ? { attrs: { ...sourceAttrs, ...mathAttrs } } : {}),
      ...(Array.isArray(node.content) ? { content: await Promise.all(node.content.map(child => walk(child as Json))) } : {}),
    } as Json
  }
  return Promise.all(stems.map(async stem => ({
    ...stem, stem_text: (await walk(stem.stem_text)) ?? stem.stem_text,
    questions: await Promise.all(stem.questions.map(async question => ({
      ...question, question_text: (await walk(question.question_text)) ?? question.question_text,
      answer_explanation: await walk(question.answer_explanation),
      answer_options: await Promise.all(question.answer_options.map(async option => ({
        ...option, answer_text: (await walk(option.answer_text)) ?? option.answer_text,
        answer_explanation: await walk(option.answer_explanation),
      }))),
    }))),
  })))
}
