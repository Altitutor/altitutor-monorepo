import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type ReviewedRow = {
  stemId: string
  environments: Array<'development' | 'production'>
  action: 'retain' | 'reclassify' | 'soft_delete'
  approvedCategory: string | null
}

type ReviewedReport = {
  summary: {
    uniqueStemIds: number
    sharedStemIds: number
    developmentOnlyStemIds: number
    productionOnlyStemIds: number
    development: {
      sourceRows: number
      quarantined: number
      unresolvedActivePublished: number
      responseCategoryCouplingEvidence: number
    }
    production: {
      sourceRows: number
      quarantined: number
      unresolvedActivePublished: number
      responseCategoryCouplingEvidence: number
    }
  }
  rows: ReviewedRow[]
}

type SourceAudit = { rows: Array<{ stemId: string }> }

const repoPath = (...parts: string[]): string =>
  resolve(process.cwd(), '../..', ...parts)

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T

describe('ALTI-540 reviewed category migration', () => {
  const reviewedPath = repoPath(
    'docs/audits/alti-540-dm-category-reviewed-mapping-2026-08-10.json'
  )
  const developmentAuditPath = repoPath(
    'docs/audits/alti-540-dm-category-audit-2026-08-10.json'
  )
  const productionAuditPath = repoPath(
    'docs/audits/alti-540-dm-category-audit-prod-2026-08-10.json'
  )
  const migrationPath = repoPath(
    'supabase/migrations/20260810143000_reclassify_reviewed_decision_making_content.sql'
  )

  it('contains one reviewed action for every stable ID in both source audits', () => {
    const reviewed = readJson<ReviewedReport>(reviewedPath)
    const development = readJson<SourceAudit>(developmentAuditPath)
    const production = readJson<SourceAudit>(productionAuditPath)
    const reviewedIds = new Set(reviewed.rows.map((row) => row.stemId))
    const sourceIds = new Set([
      ...development.rows.map((row) => row.stemId),
      ...production.rows.map((row) => row.stemId),
    ])

    expect(reviewed.rows).toHaveLength(414)
    expect(reviewedIds.size).toBe(414)
    expect(reviewedIds).toEqual(sourceIds)
    expect(reviewed.summary).toMatchObject({
      uniqueStemIds: 414,
      sharedStemIds: 174,
      developmentOnlyStemIds: 163,
      productionOnlyStemIds: 77,
      development: {
        sourceRows: 337,
        quarantined: 1,
        unresolvedActivePublished: 0,
        responseCategoryCouplingEvidence: 0,
      },
      production: {
        sourceRows: 251,
        quarantined: 0,
        unresolvedActivePublished: 0,
        responseCategoryCouplingEvidence: 0,
      },
    })
  })

  it('maps every classified ID in SQL and quarantines only the approved garbage stem', () => {
    const reviewed = readJson<ReviewedReport>(reviewedPath)
    const migration = readFileSync(migrationPath, 'utf8')
    const mappedIds = new Set(
      [...migration.matchAll(/\('([0-9a-f-]{36})'::uuid, '[0-9a-f-]{36}'::uuid\)/gu)]
        .map((match) => match[1])
    )
    const classifiedIds = new Set(
      reviewed.rows
        .filter((row) => row.approvedCategory !== null)
        .map((row) => row.stemId)
    )
    const quarantined = reviewed.rows.filter((row) => row.action === 'soft_delete')

    expect(mappedIds).toEqual(classifiedIds)
    expect(mappedIds.size).toBe(413)
    expect(quarantined).toEqual([
      expect.objectContaining({
        stemId: 'e421a4e9-308b-44c3-a709-0a9008085524',
        environments: ['development'],
        approvedCategory: null,
      }),
    ])
    expect(migration).not.toMatch(/response_type|answer_scheme|answer_key_value/u)
  })
})
