/** @jest-environment node */
import sharp from 'sharp'
import type { Json } from '@altitutor/shared'
import { preparePdfMath } from '../math-images'
import type { UcatPdfStem } from '../UcatQuestionExportDocument'

function stems(content: Json[]): UcatPdfStem[] {
  return [{ id: 'fixture', section_name: 'Quantitative Reasoning', stem_text: { type: 'doc', content }, questions: [] }]
}
function nodes(value: UcatPdfStem[]) {
  return (value[0].stem_text as { content: Array<{ attrs: Record<string, unknown> }> }).content
}

describe('PDF mathematics preparation', () => {
  it('preserves authored content while producing nonblank equation images', async () => {
    const original = stems([
      { type: 'inlineMath', attrs: { latex: 'z^3 + 17 = 42' } },
      { type: 'blockMath', attrs: { latex: '\\frac{7}{9}' } },
    ])
    const before = JSON.stringify(original)
    const prepared = nodes(await preparePdfMath(original))
    expect(JSON.stringify(original)).toBe(before)
    for (const node of prepared) {
      expect(node.attrs.pdfMathSrc).toMatch(/^data:image\/png;base64,/u)
      const bytes = Buffer.from(String(node.attrs.pdfMathSrc).split(',')[1], 'base64')
      const stats = await sharp(bytes).stats()
      expect(stats.channels[3].min).toBe(0)
      expect(stats.channels[3].max).toBeGreaterThan(0)
    }
    // The complete inline equation must be rendered, rather than only the first
    // segment emitted by MathJax's optional inline line-breaking mode.
    expect(Number(prepared[0].attrs.pdfMathWidth)).toBeGreaterThan(5)
  })

  it('retains invalid source for labelled fallback and ignores authored image attributes', async () => {
    const latex = '\\unknownPdfCommand{1}'
    const [node] = nodes(await preparePdfMath(stems([{ type: 'inlineMath', attrs: {
      latex, pdfMathSrc: 'https://untrusted.invalid/image', pdfMathWidth: 1, pdfMathHeight: 1,
    } }])))
    expect(node.attrs).toEqual({ latex })
  })

  it('isolates TeX macro definitions between exports', async () => {
    const first = await preparePdfMath(stems([{ type: 'inlineMath', attrs: { latex: '\\newcommand{\\privateMacro}{42}\\privateMacro' } }]))
    expect(nodes(first)[0].attrs.pdfMathSrc).toBeDefined()
    const second = await preparePdfMath(stems([{ type: 'inlineMath', attrs: { latex: '\\privateMacro' } }]))
    expect(nodes(second)[0].attrs.pdfMathSrc).toBeUndefined()
  })
})
