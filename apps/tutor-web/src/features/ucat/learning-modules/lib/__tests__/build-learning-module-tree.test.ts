import { buildModuleSectionTreeNodes } from '../build-learning-module-tree'
import type { UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'

const VR = 'section-vr'
const DM = 'section-dm'

function row(
  partial: Pick<UcatLearningModuleRow, 'id' | 'title' | 'kind' | 'ucat_section_id' | 'parent_ucat_learning_module_id'> &
    Partial<UcatLearningModuleRow>,
): UcatLearningModuleRow {
  return {
    description: null,
    icon_key: 'book-open',
    estimated_minutes: null,
    index: 0,
    status: 'published',
    access_scope: 'public',
    section_name: null,
    section_number: null,
    child_count: 0,
    block_count: 0,
    created_at: '',
    updated_at: '',
    created_by: null,
    created_by_first_name: null,
    created_by_last_name: null,
    deleted_at: null,
    study_plan_priority: 'recommended',
    study_plan_category_ids: [],
    study_plan_tag_ids: [],
    ...partial,
  }
}

describe('buildModuleSectionTreeNodes', () => {
  const rows: UcatLearningModuleRow[] = [
    row({
      id: 'core',
      title: 'Core Curriculum',
      kind: 'folder',
      ucat_section_id: null,
      parent_ucat_learning_module_id: null,
      index: 0,
    }),
    row({
      id: 'foundations',
      title: '00 — UCAT Foundations',
      kind: 'folder',
      ucat_section_id: null,
      parent_ucat_learning_module_id: 'core',
      index: 0,
    }),
    row({
      id: 'vr',
      title: '01 — Verbal Reasoning',
      kind: 'folder',
      ucat_section_id: VR,
      parent_ucat_learning_module_id: 'core',
      index: 1,
    }),
    row({
      id: 'vr-lesson',
      title: 'Reading comprehension',
      kind: 'lesson',
      ucat_section_id: VR,
      parent_ucat_learning_module_id: 'vr',
      index: 0,
    }),
    row({
      id: 'dm',
      title: '02 — Decision Making',
      kind: 'folder',
      ucat_section_id: DM,
      parent_ucat_learning_module_id: 'core',
      index: 2,
    }),
  ]

  it('places sectioned clusters under their section even when nested under an unsectioned umbrella', () => {
    const vrNodes = buildModuleSectionTreeNodes(rows, VR)
    expect(vrNodes.map((node) => node.id)).toEqual(['vr'])
    expect(vrNodes[0]?.children.map((node) => node.id)).toEqual(['vr-lesson'])
    expect(vrNodes[0]?.children[0]?.status).toBe('published')

    const dmNodes = buildModuleSectionTreeNodes(rows, DM)
    expect(dmNodes.map((node) => node.id)).toEqual(['dm'])
  })

  it('keeps only unsectioned umbrella nodes under null', () => {
    const unsectioned = buildModuleSectionTreeNodes(rows, null)
    expect(unsectioned.map((node) => node.id)).toEqual(['core'])
    expect(unsectioned[0]?.children.map((node) => node.id)).toEqual(['foundations'])
  })
})
