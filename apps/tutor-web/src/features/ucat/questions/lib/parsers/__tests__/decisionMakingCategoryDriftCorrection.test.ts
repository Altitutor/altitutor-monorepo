import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoPath = (...parts: string[]): string =>
  resolve(process.cwd(), '../..', ...parts)

describe('ALTI-540 production category drift correction', () => {
  const preparationName = '20260810142900_prepare_reviewed_dm_category_drift.sql'
  const reviewedMigrationName = '20260810143000_reclassify_reviewed_decision_making_content.sql'
  const reconciliationName = '20260810143100_reconcile_reviewed_dm_category_drift.sql'
  const preparation = readFileSync(repoPath('supabase/migrations', preparationName), 'utf8')
  const reconciliation = readFileSync(repoPath('supabase/migrations', reconciliationName), 'utf8')

  it('runs the exact-state bridge around the immutable reviewed migration', () => {
    expect(preparationName < reviewedMigrationName).toBe(true)
    expect(reviewedMigrationName < reconciliationName).toBe(true)

    for (const stemId of [
      '00e845fc-83db-455d-91c8-f3d436563a1c',
      '611ad210-c7c7-4093-880a-0ee9870b2daa',
      'cfbff7c7-baaf-4856-bc06-4cdd2034306f',
    ]) {
      expect(preparation).toContain(stemId)
      expect(reconciliation).toContain(stemId)
    }

    expect(preparation).toContain('unexpected source category')
    expect(reconciliation).toContain('unexpected post-migration category')
    expect(reconciliation).toContain('reconciliation verification failed')
  })

  it('preserves the final semantic decisions without changing the immutable mapping', () => {
    const logicalPuzzlesId = '1ec3d39d-ae61-4ea6-9cef-bd149a96fd3a'
    const iidcId = '24df84c6-47d7-45d3-a255-e32d23c20eef'

    expect(reconciliation).toContain(
      `'00e845fc-83db-455d-91c8-f3d436563a1c'::UUID, v_logical_puzzles_id`,
    )
    expect(reconciliation).toContain(
      `'611ad210-c7c7-4093-880a-0ee9870b2daa'::UUID, v_iidc_id`,
    )
    expect(reconciliation).toContain(
      `'cfbff7c7-baaf-4856-bc06-4cdd2034306f'::UUID, v_logical_puzzles_id`,
    )
    expect(reconciliation).toContain(logicalPuzzlesId)
    expect(reconciliation).toContain(iidcId)
  })
})
