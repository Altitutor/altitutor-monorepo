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

type SourceAudit = {
  rows: Array<{
    stemId: string
    status: string
    stemLifecycle: 'active' | 'stem_deleted'
  }>
}

type VerificationEnvironment = {
  projectRef: string
  sourceRows: number
  postMigrationCategoryCounts: Record<string, number>
  quarantinedStemIds: string[]
  unresolvedActivePublishedStemIds: string[]
  responseContractDecisionFields: string[]
}

type VerificationReport = {
  checks: {
    mappedStableIds: number
    quarantinedStableIds: number
    localMigrationApplied: boolean
  }
  environments: {
    development: VerificationEnvironment
    production: VerificationEnvironment
  }
}

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
  const verificationPath = repoPath(
    'docs/audits/alti-540-dm-category-post-migration-verification-2026-08-10.json'
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

  it('derives the post-migration verification from source rows and reviewed decisions', () => {
    const reviewed = readJson<ReviewedReport>(reviewedPath)
    const verification = readJson<VerificationReport>(verificationPath)
    const audits = {
      development: readJson<SourceAudit>(developmentAuditPath),
      production: readJson<SourceAudit>(productionAuditPath),
    }
    const projectRefs = {
      development: 'ysfslbdcacpbemodkwtl',
      production: 'mzgunxjfgvcyivcyqimn',
    }
    const responseContractFieldNames = new Set([
      'responseType',
      'response_type',
      'answerScheme',
      'answer_scheme',
      'answerKeyValue',
      'answer_key_value',
      'questionType',
      'question_type',
      'is_answer',
    ])

    const derived = Object.fromEntries(
      Object.entries(audits).map(([environment, audit]) => {
        const decisions = new Map(
          reviewed.rows
            .filter((row) => row.environments.includes(environment as 'development' | 'production'))
            .map((row) => [row.stemId, row])
        )
        const unresolvedActivePublishedStemIds = audit.rows
          .filter((row) => row.stemLifecycle === 'active' && row.status === 'published')
          .filter((row) => {
            const decision = decisions.get(row.stemId)
            return !decision ||
              (decision.approvedCategory === null && decision.action !== 'soft_delete')
          })
          .map((row) => row.stemId)
        const categoryCounts: Record<string, number> = {}
        for (const row of audit.rows) {
          const category = decisions.get(row.stemId)?.approvedCategory
          if (category) categoryCounts[category] = (categoryCounts[category] ?? 0) + 1
        }
        const decisionFieldNames = new Set<string>()
        const visit = (value: unknown): void => {
          if (!value || typeof value !== 'object') return
          if (Array.isArray(value)) {
            value.forEach(visit)
            return
          }
          for (const [key, child] of Object.entries(value)) {
            if (responseContractFieldNames.has(key)) decisionFieldNames.add(key)
            visit(child)
          }
        }
        visit(audit.rows)
        visit([...decisions.values()])

        return [environment, {
          projectRef: projectRefs[environment as keyof typeof projectRefs],
          sourceRows: audit.rows.length,
          postMigrationCategoryCounts: categoryCounts,
          quarantinedStemIds: [...decisions.values()]
            .filter((row) => row.action === 'soft_delete')
            .map((row) => row.stemId),
          unresolvedActivePublishedStemIds,
          responseContractDecisionFields: [...decisionFieldNames].sort(),
        }]
      })
    )

    expect(verification.checks).toEqual({
      mappedStableIds: 413,
      quarantinedStableIds: 1,
      localMigrationApplied: true,
    })
    expect(verification.environments).toEqual(derived)
  })
})
