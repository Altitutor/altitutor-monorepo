import {
  generatedContentToPlainText,
  generatedContentToProseMirror,
  getGeneratedVisualSpecIssue,
} from '../content-blocks'
import { GeneratedCandidateResponseSchema, type GeneratedContentBlock } from '../schema'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('vega-lite', () => ({
  compile: jest.fn((spec) => ({ spec })),
}))
jest.mock('vega', () => ({
  parse: jest.fn((spec) => spec),
  View: jest.fn().mockImplementation(() => ({
    toSVG: jest.fn(async () => '<svg><text>Deliveries by zone</text><text>Inner</text><text>Order type</text><rect fill="#111111"/></svg>'),
    finalize: jest.fn(),
  })),
}))

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

  it('renders Vega-Lite charts on the server from inline data', async () => {
    const { generatedContentToProseMirrorServer } = await import('../server-content-blocks')
    const doc = await generatedContentToProseMirrorServer([{
      type: 'visual',
      visualType: 'vega_lite_chart',
      title: 'Deliveries by zone',
      altText: 'Black and white chart of deliveries by zone.',
      spec: {
        data: {
          values: [
            { zone: 'Inner', type: 'Normal', orders: 420 },
            { zone: 'Inner', type: 'Urgent', orders: 126 },
            { zone: 'West', type: 'Normal', orders: 360 },
            { zone: 'West', type: 'Urgent', orders: 90 },
          ],
        },
        mark: { type: 'bar' },
        encoding: {
          y: { field: 'zone', type: 'nominal', axis: { title: 'Zone' } },
          x: { field: 'orders', type: 'quantitative', axis: { title: 'Orders' } },
          color: { field: 'type', type: 'nominal', legend: { title: 'Order type' } },
          yOffset: { field: 'type' },
        },
      },
    }]) as { content?: Array<{ attrs?: { src?: string; alt?: string } }> }

    const src = doc.content?.[0]?.attrs?.src ?? ''
    const svg = decodeURIComponent(src)
    expect(src).toContain('data:image/svg+xml')
    expect(svg).toContain('Deliveries by zone')
    expect(svg).toContain('Inner')
    expect(svg).toContain('Order type')
    expect(svg).toContain('#111111')
    expect(doc.content?.[0]?.attrs?.alt).toBe('Black and white chart of deliveries by zone.')
  })

  it('rejects Vega-Lite chart specs without inline data', () => {
    expect(getGeneratedVisualSpecIssue({
      type: 'visual',
      visualType: 'vega_lite_chart',
      title: 'External chart',
      altText: 'Chart.',
      spec: {
        data: { url: 'https://example.com/data.json' },
        mark: 'bar',
        encoding: {
          x: { field: 'a', type: 'nominal' },
          y: { field: 'b', type: 'quantitative' },
        },
      },
    })).toBe('vega_lite_chart needs inline data.values or datasets.')
  })

  it('rejects legacy generated visual types at the schema boundary', () => {
    const parsed = GeneratedCandidateResponseSchema.safeParse({
      stems: [{
        stemText: [{
          type: 'visual',
          visualType: 'route_map',
          title: 'Park walking paths',
          altText: 'Route map.',
          spec: {
            points: [{ id: 'gate', label: 'Gate', x: 10, y: 20 }],
            lines: [],
          },
        }],
        questions: [{
          questionText: 'Which is correct?',
          questionType: 'multiple_choice',
          answerExplanation: 'The route map is no longer an accepted generated visual type.',
          options: [
            { answerText: 'A', isAnswer: true },
            { answerText: 'B', isAnswer: false },
          ],
        }],
      }],
    })

    expect(parsed.success).toBe(false)
  })

  it('normalizes generated mixed-shape set diagrams into stable circle layouts', () => {
    const doc = generatedContentToProseMirror([{
      type: 'visual',
      visualType: 'set_diagram',
      title: 'Subjects',
      altText: 'Mixed set diagram.',
      spec: {
        shapes: [
          { id: 'B', shape: 'triangle', label: 'Biology', x: 120, y: 70, width: 210, height: 220 },
          { id: 'C', shape: 'pentagon', label: 'Chemistry', cx: 300, cy: 210, r: 80 },
          { id: 'M', shape: 'circle', label: 'Maths', cx: 410, cy: 210, r: 92 },
        ],
        regionLabels: [
          { text: 28, include: ['C'], exclude: ['B', 'M'] },
          { text: 11, include: ['B'], exclude: ['C', 'M'] },
          { text: 5, region: 'outside' },
        ],
      },
    }]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    expect(svg).toContain('Biology')
    expect(svg).toContain('Chemistry')
    expect(svg).toContain('height="430"')
    expect(svg).toContain('<circle')
    expect(svg).toContain('cx="285"')
    expect(svg).toContain('cx="395"')
    expect(svg).toContain('>28<')
    expect(svg).toContain('>11<')
    expect(svg).toContain('>5<')
  })

  it('keeps labels on repeated same-shape diagrams instead of using an ambiguous legend', () => {
    const doc = generatedContentToProseMirror([{
      type: 'visual',
      visualType: 'set_diagram',
      title: 'Fruit packs',
      altText: 'Three-circle answer option.',
      spec: {
        shapes: [
          { id: 'R', shape: 'circle', label: 'Raisins', cx: 230, cy: 180, r: 92 },
          { id: 'S', shape: 'circle', label: 'Sultanas', cx: 330, cy: 180, r: 92 },
          { id: 'C', shape: 'circle', label: 'Chocolate', cx: 280, cy: 260, r: 92 },
        ],
        regionLabels: [
          { text: 12, include: ['R'], exclude: ['S', 'C'] },
          { text: 8, include: ['S'], exclude: ['R', 'C'] },
          { text: 3, region: 'outside' },
        ],
      },
    }]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    expect(svg).toContain('Raisins')
    expect(svg).toContain('Sultanas')
    expect(svg).toContain('Chocolate')
    expect(svg).toContain('>12<')
    expect(svg).not.toContain('x="625"')
  })

  it('places numeric labels in dense three-set Venn regions without failing on narrow gaps', () => {
    const block: Extract<GeneratedContentBlock, { type: 'visual' }> = {
      type: 'visual' as const,
      visualType: 'venn_diagram' as const,
      title: 'Training sessions',
      altText: 'Dense three-set Venn diagram.',
      spec: {
        shapes: [
          { id: 'A', shape: 'circle', label: 'First aid', cx: 260, cy: 185, r: 112 },
          { id: 'B', shape: 'circle', label: 'Data security', cx: 360, cy: 185, r: 112 },
          { id: 'C', shape: 'circle', label: 'Patient handling', cx: 310, cy: 268, r: 112 },
        ],
        regionLabels: [
          { text: 126, region: 'A only' },
          { text: 94, region: 'B only' },
          { text: 78, region: 'C only' },
          { text: 41, region: 'A & B & not C' },
          { text: 32, region: 'A & C & not B' },
          { text: 29, region: 'B & C & not A' },
          { text: 15, region: 'A & B & C' },
          { text: 203, region: 'outside' },
        ],
      },
    }

    expect(getGeneratedVisualSpecIssue(block)).toBeNull()
    const doc = generatedContentToProseMirror([block]) as { content?: Array<{ attrs?: { src?: string } }> }
    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    expect(svg).toContain('>126<')
    expect(svg).toContain('>41<')
    expect(svg).toContain('>15<')
    expect(svg).toContain('>203<')
  })

  it('normalizes generated three-circle coordinates before placing semantic regions', () => {
    const block: Extract<GeneratedContentBlock, { type: 'visual' }> = {
      type: 'visual',
      visualType: 'venn_diagram',
      title: 'Visitors',
      altText: 'Three-circle Venn diagram with unstable model coordinates.',
      spec: {
        shapes: [
          { id: 'A', shape: 'circle', label: 'Audio guide', cx: 160, cy: 180, r: 70 },
          { id: 'B', shape: 'circle', label: 'Cafe', cx: 500, cy: 180, r: 70 },
          { id: 'C', shape: 'circle', label: 'Shop', cx: 330, cy: 350, r: 70 },
        ],
        regionLabels: [
          { text: 4, region: 'A & B & C' },
          { text: 12, region: 'A only' },
          { text: 9, region: 'B only' },
          { text: 7, region: 'C only' },
        ],
      },
    }

    expect(getGeneratedVisualSpecIssue(block)).toBeNull()
    const doc = generatedContentToProseMirror([block]) as { content?: Array<{ attrs?: { src?: string } }> }
    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    expect(svg).toContain('>4<')
    expect(svg).toContain('cx="285"')
    expect(svg).toContain('cx="395"')
  })

  it('rejects generated four-set diagrams instead of rendering ambiguous tiny regions', () => {
    expect(getGeneratedVisualSpecIssue({
      type: 'visual',
      visualType: 'set_diagram',
      title: 'Ambiguous',
      altText: 'Four-set diagram.',
      spec: {
        shapes: [
          { id: 'R', shape: 'rect', label: 'Reserved workshop', x: 120, y: 100, width: 280, height: 220 },
          { id: 'C', shape: 'circle', label: 'Concession ticket', cx: 360, cy: 225, r: 120 },
          { id: 'T', shape: 'triangle', label: 'Travelled by train', x: 250, y: 70, width: 260, height: 280 },
          { id: 'G', shape: 'pentagon', label: 'Bought printed guide', cx: 300, cy: 260, r: 105 },
        ],
        regionLabels: [
          { text: 4, region: 'R & C & T & G' },
          { text: 7, region: 'R only' },
          { text: 6, region: 'outside' },
        ],
      },
    })).toBe('Generated set diagrams support two or three sets only. Use a simpler two-set or three-set Venn diagram.')
  })

  it('renders a range of generated-like Venn and set diagrams without placement failures', () => {
    const visualBlocks: Array<Extract<GeneratedContentBlock, { type: 'visual' }>> = [
      {
        type: 'visual',
        visualType: 'venn_diagram',
        title: 'Club membership',
        altText: 'Two-set Venn diagram.',
        spec: {
          shapes: [
            { id: 'A', shape: 'circle', label: 'Art', cx: 275, cy: 210, r: 118 },
            { id: 'B', shape: 'circle', label: 'Drama', cx: 365, cy: 210, r: 118 },
          ],
          regionLabels: [
            { text: 87, region: 'A only' },
            { text: 64, region: 'B only' },
            { text: 23, region: 'A & B' },
            { text: 112, region: 'outside' },
          ],
        },
      },
      {
        type: 'visual',
        visualType: 'set_diagram',
        title: 'Services used',
        altText: 'Mixed-shape set diagram.',
        spec: {
          shapes: [
            { id: 'W', shape: 'triangle', label: 'Workshop', x: 160, y: 72, width: 300, height: 260 },
            { id: 'O', shape: 'ellipse', label: 'Online', cx: 360, cy: 210, rx: 158, ry: 104 },
            { id: 'S', shape: 'diamond', label: 'Subsidy', cx: 365, cy: 246, width: 230, height: 190 },
          ],
          regionLabels: [
            { text: 51, region: 'W only' },
            { text: 34, region: 'O only' },
            { text: 19, region: 'S only' },
            { text: 8, region: 'W & O & not S' },
            { text: 5, region: 'O & S & not W' },
            { text: 2, region: 'W & O & S' },
            { text: 141, region: 'outside' },
          ],
        },
      },
    ]

    for (const block of visualBlocks) {
      expect(getGeneratedVisualSpecIssue(block)).toBeNull()
      const doc = generatedContentToProseMirror([block]) as { content?: Array<{ attrs?: { src?: string } }> }
      const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
      expect(svg).toContain('data:image/svg+xml')
      const labels = Array.isArray((block.spec as { regionLabels?: unknown }).regionLabels)
        ? (block.spec as { regionLabels: Array<{ text: string | number }> }).regionLabels
        : []
      for (const label of labels) {
        expect(svg).toContain(`>${label.text}<`)
      }
    }
  })

  it('rejects numeric set labels without semantic regions', () => {
    expect(getGeneratedVisualSpecIssue({
      type: 'visual',
      visualType: 'set_diagram',
      title: 'Unsafe',
      altText: 'Unsafe set diagram.',
      spec: {
        shapes: [
          { id: 'A', shape: 'circle', label: 'A', cx: 240, cy: 190, r: 95 },
          { id: 'B', shape: 'circle', label: 'B', cx: 340, cy: 190, r: 95 },
        ],
        regionLabels: [{ text: 12, x: 290, y: 190 }],
      },
    })).toBe('Set diagram numeric label "12" needs a semantic set-region expression.')
  })
})
