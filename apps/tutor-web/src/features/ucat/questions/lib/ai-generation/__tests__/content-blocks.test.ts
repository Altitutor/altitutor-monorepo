import {
  generatedContentToPlainText,
  generatedContentToProseMirror,
} from '../content-blocks'
import { GeneratedCandidateResponseSchema } from '../schema'

describe('generated content blocks', () => {
  it('converts bold markers into ProseMirror marks', () => {
    const doc = generatedContentToProseMirror('Which option **MUST** be true?')

    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Which option ' },
            { type: 'text', text: 'MUST', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' be true?' },
          ],
        },
      ],
    })
  })

  it('removes bold markers from comparison text', () => {
    expect(generatedContentToPlainText('Which option **CANNOT** be true?')).toBe(
      'Which option CANNOT be true?'
    )
  })

  it('normalizes object-shaped generated tables', () => {
    const parsed = GeneratedCandidateResponseSchema.parse({
      stems: [{
        stemText: [{
          type: 'table',
          caption: 'Results',
          columns: [
            { accessor: 'name', header: 'Name' },
            { accessor: 'score', header: 'Score' },
          ],
          rows: [{ name: 'Asha', score: 12 }],
        }],
        questions: [{
          questionText: 'Which is correct?',
          questionType: 'multiple_choice',
          answerExplanation: 'Asha has the recorded score.',
          options: [
            { answerText: 'Asha', isAnswer: true },
            { answerText: 'Ben', isAnswer: false },
          ],
        }],
      }],
    })

    expect(parsed.stems[0]?.stemText).toEqual([{
      type: 'table',
      caption: 'Results',
      columns: ['Name', 'Score'],
      rows: [['Asha', '12']],
    }])
  })

  it('renders deterministic three-set Venn diagrams', () => {
    const doc = generatedContentToProseMirror([{
      type: 'visual',
      visualType: 'venn_diagram',
      title: 'Activities',
      altText: 'Three overlapping activity sets.',
      spec: {
        sets: [
          { id: 'A', label: 'Art' },
          { id: 'B', label: 'Books' },
          { id: 'C', label: 'Chess' },
        ],
        regions: { aOnly: 2, bOnly: 3, cOnly: 4, abOnly: 5, acOnly: 6, bcOnly: 7, abc: 8, outside: 9 },
      },
    }]) as { content?: Array<{ attrs?: { src?: string } }> }

    const src = doc.content?.[0]?.attrs?.src ?? ''
    expect(src).toContain('data:image/svg+xml')
    expect(decodeURIComponent(src)).toContain('Chess')
    expect(decodeURIComponent(src)).toContain('>8<')
    expect(decodeURIComponent(src)).not.toContain('#93c5fd')
  })

  it('converts generated list blocks into ProseMirror lists', () => {
    const doc = generatedContentToProseMirror([{
      type: 'list',
      ordered: true,
      items: ['Set up a grid.', 'Eliminate impossible options.'],
    }])

    expect(doc).toEqual({
      type: 'doc',
      content: [{
        type: 'orderedList',
        attrs: { start: 1 },
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Set up a grid.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Eliminate impossible options.' }] }] },
        ],
      }],
    })
  })

  it('renders grouped bar chart legends below the title band', () => {
    const doc = generatedContentToProseMirror([{
      type: 'visual',
      visualType: 'bar_chart',
      title: 'Prescriptions dispensed and percentage collected after 6 pm',
      altText: 'Grouped bar chart.',
      spec: {
        labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        series: [
          { name: 'Dispensed', values: [320, 280, 360, 300] },
          { name: 'Collected after 6 pm', values: [25, 30, 20, 35] },
        ],
        style: { palette: 'teal_amber' },
      },
    }]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    expect(svg).toContain('y="34"')
    expect(svg).toContain('y="62"')
    expect(svg).toContain('y="74"')
    expect(svg).toContain('#0f766e')
  })

  it('renders stacked bars, multi-line charts, scatter plots, pie charts, and set diagrams', () => {
    const doc = generatedContentToProseMirror([
      {
        type: 'visual',
        visualType: 'stacked_bar_chart',
        title: 'Monthly totals',
        altText: 'Stacked monthly totals.',
        spec: {
          labels: ['Jan', 'Feb'],
          series: [
            { name: 'Online', values: [10, 20] },
            { name: 'In person', values: [15, 12] },
          ],
        },
      },
      {
        type: 'visual',
        visualType: 'line_chart',
        title: 'Campaign involvement',
        altText: 'Two-line graph.',
        spec: {
          labels: ['1/14', '2/14', '3/14'],
          series: [
            { name: 'Group A', values: [20, 35, 40] },
            { name: 'Group B', values: [18, 28, 31] },
          ],
        },
      },
      {
        type: 'visual',
        visualType: 'scatter_plot',
        title: 'Practice time and score',
        altText: 'Scatter plot.',
        spec: { points: [{ x: 2, y: 40, label: 'A' }, { x: 5, y: 65, label: 'B' }] },
      },
      {
        type: 'visual',
        visualType: 'pie_chart',
        title: 'Share by type',
        altText: 'Pie chart.',
        spec: { labels: ['A', 'B'], values: [30, 70] },
      },
      {
        type: 'visual',
        visualType: 'set_diagram',
        title: null,
        altText: 'Irregular overlapping set diagram.',
        spec: {
          shapes: [
            { shape: 'triangle', label: 'Biology', x: 120, y: 70, width: 220, height: 230 },
            { shape: 'rect', label: 'Chemistry', x: 210, y: 130, width: 220, height: 160 },
            { shape: 'circle', label: 'Maths', cx: 390, cy: 210, r: 95 },
            { shape: 'pentagon', label: 'French', cx: 455, cy: 185, r: 72 },
            { shape: 'hexagon', label: 'History', cx: 250, cy: 265, r: 78 },
          ],
          labels: [{ text: 15, x: 310, y: 220, bold: true }],
        },
      },
    ]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svgs = (doc.content ?? [])
      .filter((node) => node.attrs?.src)
      .map((node) => decodeURIComponent(node.attrs?.src ?? ''))

    expect(svgs[0]).toContain('In person')
    expect(svgs[1]).toContain('Group B')
    expect(svgs[2]).toContain('<circle')
    expect(svgs[2]).toContain('>B<')
    expect(svgs[3]).toContain('<path')
    expect(svgs[4]).toContain('<polygon')
    expect(svgs[4]).toContain('French')
    expect(svgs[4]).toContain('History')
    expect(svgs[4]).toContain('>15<')
  })
})
