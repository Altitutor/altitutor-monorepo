import { filterTagsForImportSection } from '../taxonomy-reparent'

const QR = 'section-qr'
const VR = 'section-vr'

describe('filterTagsForImportSection', () => {
  const rows = [
    { id: 'qr-root', name: 'QR root', parent_question_tag_id: null, ucat_section_id: QR },
    { id: 'qr-child', name: 'QR child', parent_question_tag_id: 'qr-root', ucat_section_id: null },
    { id: 'vr-root', name: 'VR root', parent_question_tag_id: null, ucat_section_id: VR },
    { id: 'vr-child', name: 'VR child', parent_question_tag_id: 'vr-root', ucat_section_id: null },
    { id: 'global-root', name: 'Global', parent_question_tag_id: null, ucat_section_id: null },
    {
      id: 'global-child',
      name: 'Global child',
      parent_question_tag_id: 'global-root',
      ucat_section_id: null,
    },
  ]

  it('includes current section tags, unsectioned tags, and their descendants', () => {
    const filtered = filterTagsForImportSection(rows, QR)
    expect(filtered.map((row) => row.id)).toEqual([
      'qr-root',
      'qr-child',
      'global-root',
      'global-child',
    ])
  })

  it('excludes other section tags and their descendants', () => {
    const filtered = filterTagsForImportSection(rows, QR)
    expect(filtered.map((row) => row.id)).not.toContain('vr-root')
    expect(filtered.map((row) => row.id)).not.toContain('vr-child')
  })

  it('returns all rows when sectionId is null', () => {
    expect(filterTagsForImportSection(rows, null)).toEqual(rows)
  })
})
