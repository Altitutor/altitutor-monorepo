import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoPath = (...parts: string[]): string =>
  resolve(process.cwd(), '../..', ...parts)

const MAPPING_PATTERN =
  /\('([0-9a-f-]{36})'::uuid, '([0-9a-f-]{36})'::uuid\)/gu

const APPROVED_CATEGORY_IDS = new Set([
  'b35d193a-d054-4ac2-8ae3-669ac1ff79bc', // Syllogisms
  '24df84c6-47d7-45d3-a255-e32d23c20eef', // Interpreting Information and Drawing Conclusions
  'af97ced6-4266-4926-988b-2cc6cf288e23', // Probabilistic and Statistical Reasoning
])

const QUARANTINED_STEM_ID = 'e421a4e9-308b-44c3-a709-0a9008085524'

describe('ALTI-540 reviewed category migration', () => {
  const migrationPath = repoPath(
    'supabase/migrations/20260810143000_reclassify_reviewed_decision_making_content.sql'
  )
  const migration = readFileSync(migrationPath, 'utf8')
  const mappings = [...migration.matchAll(MAPPING_PATTERN)].map((match) => ({
    stemId: match[1],
    categoryId: match[2],
  }))

  it('maps 413 reviewed stems to approved Decision Making categories', () => {
    const stemIds = new Set(mappings.map((mapping) => mapping.stemId))
    const categoryIds = new Set(mappings.map((mapping) => mapping.categoryId))

    expect(mappings).toHaveLength(413)
    expect(stemIds.size).toBe(413)
    expect([...categoryIds].every((id) => APPROVED_CATEGORY_IDS.has(id))).toBe(true)
    expect(migration).toContain('ALTI-540 reviewed mapping is incomplete')
  })

  it('quarantines the approved garbage stem outside the reviewed mapping', () => {
    const mappedStemIds = new Set(mappings.map((mapping) => mapping.stemId))

    expect(mappedStemIds.has(QUARANTINED_STEM_ID)).toBe(false)
    expect(migration).toContain(`v_quarantined_stem_id CONSTANT UUID := '${QUARANTINED_STEM_ID}'`)
    expect(migration).toContain('ALTI-540 quarantine verification failed')
  })

  it('reclassifies categories only and does not touch response contracts', () => {
    expect(migration).toContain('question_stem_category_id = mapping.target_category_id')
    expect(migration).not.toMatch(/response_type|answer_scheme|answer_key_value/u)
  })
})
