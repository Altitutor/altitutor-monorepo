import {
  generatedContentToPlainText,
  generatedContentToProseMirror,
  getGeneratedVisualSpecIssue,
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
    }]) as { content?: Array<{ attrs?: { src?: string; alt?: string }, content?: unknown[] }> }

    const src = doc.content?.[0]?.attrs?.src ?? ''
    expect(src).toContain('data:image/svg+xml')
    expect(doc.content?.[0]?.attrs?.alt).toBe('')
    expect(doc.content).toHaveLength(1)
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
          regionLabels: [{ text: 15, x: 310, y: 220, bold: true }],
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

  it('rejects chart specs without plotted data', () => {
    expect(getGeneratedVisualSpecIssue({
      type: 'visual',
      visualType: 'bar_chart',
      title: 'Fee per test',
      altText: 'Empty fee chart.',
      spec: {
        yAxis: { label: 'Fee', unit: '$', min: 0, max: 12 },
        style: { showGrid: true },
      },
    })).toBe('bar_chart needs plotted numeric data in values, series, or panels.')
  })

  it('renders set diagram legends as shape swatches', () => {
    const doc = generatedContentToProseMirror([{
      type: 'visual',
      visualType: 'set_diagram',
      title: 'Subjects',
      altText: 'Mixed set diagram.',
      spec: {
        shapes: [
          { shape: 'triangle', label: 'Biology', x: 120, y: 70, width: 210, height: 220 },
          { shape: 'pentagon', label: 'Chemistry', cx: 300, cy: 210, r: 80 },
          { shape: 'circle', label: 'Maths', cx: 410, cy: 210, r: 92 },
        ],
        regionLabels: [{ text: 28, x: 318, y: 168 }],
      },
    }]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    expect(svg).toContain('Biology')
    expect(svg).toContain('Chemistry')
    expect(svg).toContain('height="520"')
    expect(svg).toContain('<polygon points="107,436')
    expect(svg).toContain('<circle cx="107" cy="483"')
    expect(svg).not.toContain('x1="585"')
  })

  it('keeps labels on repeated same-shape diagrams instead of using an ambiguous legend', () => {
    const doc = generatedContentToProseMirror([{
      type: 'visual',
      visualType: 'set_diagram',
      title: 'Fruit packs',
      altText: 'Three-circle answer option.',
      spec: {
        shapes: [
          { shape: 'circle', label: 'Raisins', cx: 230, cy: 180, r: 92 },
          { shape: 'circle', label: 'Sultanas', cx: 330, cy: 180, r: 92 },
          { shape: 'circle', label: 'Chocolate', cx: 280, cy: 260, r: 92 },
        ],
        regionLabels: [{ text: 12, x: 205, y: 165 }],
      },
    }]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    expect(svg).toContain('Raisins')
    expect(svg).toContain('Sultanas')
    expect(svg).toContain('Chocolate')
    expect(svg).not.toContain('x="625"')
  })

  it('moves crowded set diagram labels away from each other and shape boundaries', () => {
    const doc = generatedContentToProseMirror([{
      type: 'visual',
      visualType: 'set_diagram',
      title: 'Crowded sets',
      altText: 'Crowded set diagram.',
      spec: {
        shapes: [
          { shape: 'ellipse', label: 'Cycling', cx: 220, cy: 190, rx: 170, ry: 105 },
          { shape: 'ellipse', label: 'Swimming', cx: 250, cy: 190, rx: 85, ry: 56 },
          { shape: 'diamond', label: 'Volunteering', cx: 410, cy: 190, width: 185, height: 170 },
        ],
        regionLabels: [
          { text: 4, x: 250, y: 86 },
          { text: 7, x: 315, y: 145 },
          { text: 5, x: 410, y: 106 },
          { text: 6, x: 505, y: 190 },
          { text: 11, x: 505, y: 190 },
        ],
      },
    }]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    const eleven = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>11<\/text>/)
    const six = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>6<\/text>/)
    const cycling = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>Cycling<\/text>/)
    const swimming = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>Swimming<\/text>/)

    expect(eleven).not.toBeNull()
    expect(six).not.toBeNull()
    expect(cycling).not.toBeNull()
    expect(swimming).not.toBeNull()
    expect(eleven?.slice(1, 3)).not.toEqual(six?.slice(1, 3))
    expect(cycling?.slice(1, 3)).not.toEqual(swimming?.slice(1, 3))
  })

  it('converts accidental region-label legends into shape-swatch legends', () => {
    const doc = generatedContentToProseMirror([{
      type: 'visual',
      visualType: 'set_diagram',
      title: 'Cinema purchases',
      altText: 'Set diagram.',
      spec: {
        shapes: [
          { shape: 'triangle', x: 160, y: 80, width: 210, height: 220 },
          { shape: 'circle', cx: 300, cy: 150, r: 95 },
          { shape: 'pentagon', cx: 395, cy: 205, r: 105 },
          { shape: 'diamond', cx: 285, cy: 260, width: 170, height: 170 },
        ],
        regionLabels: [
          { text: 'Legend', x: 500, y: 70, bold: true },
          { text: 'Triangle = Popcorn', x: 500, y: 112 },
          { text: 'Circle = Drink', x: 500, y: 151 },
          { text: 'Pentagon = Sweets', x: 500, y: 192 },
          { text: 'Diamond = Nachos', x: 500, y: 235 },
          { text: 14, x: 115, y: 120 },
        ],
      },
    }]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    expect(svg).toContain('Popcorn')
    expect(svg).toContain('Drink')
    expect(svg).toContain('Sweets')
    expect(svg).toContain('Nachos')
    expect(svg).toContain('height="520"')
    expect(svg).toContain('<polygon points="107,436')
    expect(svg).toContain('<circle cx="407"')
    expect(svg).not.toContain('Triangle = Popcorn')
    expect(svg).not.toContain('>Legend<')
  })

  it('places semantic set-region labels without requiring raw coordinates', () => {
    const doc = generatedContentToProseMirror([{
      type: 'visual',
      visualType: 'set_diagram',
      title: 'Subject choices',
      altText: 'Set diagram with semantic region labels.',
      spec: {
        shapes: [
          { id: 'B', shape: 'circle', label: 'Biology', cx: 260, cy: 190, r: 110 },
          { id: 'C', shape: 'rect', label: 'Chemistry', x: 230, y: 130, width: 240, height: 170 },
          { id: 'M', shape: 'triangle', label: 'Maths', x: 130, y: 70, width: 350, height: 250 },
        ],
        regionLabels: [
          { text: 12, include: ['B', 'C'], exclude: ['M'], x: 320, y: 220 },
          { text: 6, region: 'B & M & not C', x: 320, y: 220 },
          { text: 4, region: 'outside', x: 320, y: 220 },
        ],
      },
    }]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svg = decodeURIComponent(doc.content?.[0]?.attrs?.src ?? '')
    const twelve = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>12<\/text>/)
    const six = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>6<\/text>/)
    expect(svg).toContain('>12<')
    expect(svg).toContain('>6<')
    expect(svg).toContain('>4<')
    expect(svg).toContain('Biology')
    expect(svg).toContain('Chemistry')
    expect(twelve?.slice(1, 3)).not.toEqual(six?.slice(1, 3))
  })

  it('renders paired chart panels, timetable visuals, route maps, and layout grids', () => {
    const doc = generatedContentToProseMirror([
      {
        type: 'visual',
        visualType: 'bar_chart',
        title: 'Clinic attendance by site',
        altText: 'Two-panel bar chart.',
        spec: {
          yAxis: { label: 'Patients' },
          panels: [
            { title: 'Week 1', labels: ['North', 'South', 'East'], values: [22, 18, 30] },
            { title: 'Week 2', labels: ['North', 'South', 'East'], values: [28, 16, 34] },
          ],
        },
      },
      {
        type: 'visual',
        visualType: 'pie_chart',
        title: 'Criminal population by category',
        altText: 'Two pie charts.',
        spec: {
          style: { palette: 'monochrome', patterned: true },
          panels: [
            { title: '1990', subtitle: '10 million', labels: ['White Collar', 'Robbery', 'Assault'], values: [38, 20, 20] },
            { title: '2000 projected', subtitle: '20 million', labels: ['White Collar', 'Robbery', 'Assault'], values: [30, 25, 20] },
          ],
        },
      },
      {
        type: 'visual',
        visualType: 'timetable',
        title: 'Rail departures',
        altText: 'Train timetable.',
        spec: {
          columns: ['Station', 'Train A', 'Train B', 'Train C'],
          rows: [
            ['Central', '08:10', '08:40', '09:10'],
            ['North', '08:22', '08:55', '09:25'],
            ['Airport', '08:47', '09:20', '09:50'],
          ],
        },
      },
      {
        type: 'visual',
        visualType: 'route_map',
        title: 'Park walking paths',
        altText: 'Route map.',
        spec: {
          points: [
            { id: 'gate', label: 'Gate', x: 70, y: 270 },
            { id: 'lake', label: 'Lake', x: 190, y: 190 },
            { id: 'hill', label: 'Hill', x: 310, y: 90 },
            { id: 'cafe', label: 'Cafe', x: 320, y: 270 },
          ],
          lines: [
            { from: 'gate', to: 'lake', label: '360 m' },
            { from: 'lake', to: 'hill', label: '420 m' },
            { from: 'lake', to: 'cafe', label: '300 m' },
          ],
        },
      },
      {
        type: 'visual',
        visualType: 'layout_grid',
        title: 'Lab benches',
        altText: 'Three-by-three lab layout.',
        spec: {
          rows: 3,
          columns: 3,
          rowLabels: ['Front', 'Middle', 'Back'],
          columnLabels: ['Left', 'Centre', 'Right'],
          cells: [{ row: 2, column: 2, label: 'Mina' }],
        },
      },
    ]) as { content?: Array<{ attrs?: { src?: string } }> }

    const svgs = (doc.content ?? []).map((node) => decodeURIComponent(node.attrs?.src ?? ''))
    expect(svgs[0]).toContain('Week 2')
    expect(svgs[1]).toContain('2000 projected')
    expect(svgs[1]).toContain('piePattern')
    expect(svgs[2]).toContain('Rail departures')
    expect(svgs[2]).toContain('Airport')
    expect(svgs[3]).toContain('360 m')
    expect(svgs[3]).toContain('Lake')
    expect(svgs[4]).toContain('Mina')
    expect(svgs[4]).toContain('Centre')
  })
})
