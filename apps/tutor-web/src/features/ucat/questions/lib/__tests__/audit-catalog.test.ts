import {
  AUDIT_CATALOG_NOT_AUDITED,
  auditMembershipChipLabel,
  auditRunOptionPrefix,
  buildAuditCatalogFilterOptions,
  isValidAuditCatalogFilter,
  parseStemAuditMemberships,
} from '@/features/ucat/questions/lib/audit-catalog'

const RUN_A = {
  id: '71000000-0000-0000-0000-000000000001',
  title: 'All draft stems',
  status: 'active',
  created_at: '2026-08-19T10:00:00.000Z',
}

const RUN_B = {
  id: '71000000-0000-0000-0000-000000000002',
  title: 'All draft stems',
  status: 'completed',
  created_at: '2026-08-20T10:00:00.000Z',
}

describe('audit catalog filters', () => {
  it('accepts not-audited, status, and status-result tokens', () => {
    expect(isValidAuditCatalogFilter(AUDIT_CATALOG_NOT_AUDITED)).toBe(true)
    expect(isValidAuditCatalogFilter(`${RUN_A.id}:failed`)).toBe(true)
    expect(isValidAuditCatalogFilter(`${RUN_A.id}:completed:updated`)).toBe(true)
    expect(isValidAuditCatalogFilter(`${RUN_A.id}:skipped:suggest_delete`)).toBe(true)
    expect(isValidAuditCatalogFilter(`${RUN_A.id}:completed:suggest_delete`)).toBe(false)
    expect(isValidAuditCatalogFilter('not-a-filter')).toBe(false)
  })

  it('fans completed and skipped out under their canonical target status', () => {
    const options = buildAuditCatalogFilterOptions([RUN_A])
    expect(options[0]).toEqual({ label: 'Not audited', value: AUDIT_CATALOG_NOT_AUDITED })
    expect(options).toEqual(expect.arrayContaining([
      { label: 'All draft stems · Completed', value: `${RUN_A.id}:completed` },
      { label: 'All draft stems · Completed · Updated', value: `${RUN_A.id}:completed:updated` },
      { label: 'All draft stems · Completed · Unchanged', value: `${RUN_A.id}:completed:unchanged` },
      { label: 'All draft stems · Skipped', value: `${RUN_A.id}:skipped` },
      { label: 'All draft stems · Skipped · Suggest delete', value: `${RUN_A.id}:skipped:suggest_delete` },
      { label: 'All draft stems · Failed', value: `${RUN_A.id}:failed` },
    ]))
    expect(options.some((option) => option.value === `${RUN_A.id}:completed:suggest_delete`)).toBe(false)
  })

  it('disambiguates duplicate titles with the created date', () => {
    expect(auditRunOptionPrefix(RUN_A, [RUN_A, RUN_B])).toBe('All draft stems · 2026-08-19')
    expect(auditRunOptionPrefix(RUN_B, [RUN_A, RUN_B])).toBe('All draft stems · 2026-08-20')
  })

  it('labels a membership by result when present', () => {
    expect(auditMembershipChipLabel({
      runId: RUN_A.id,
      title: RUN_A.title,
      runStatus: 'active',
      targetStatus: 'completed',
      result: 'updated',
      createdAt: RUN_A.created_at,
      why: null,
    })).toBe('All draft stems · Updated')
  })

  it('parses catalog membership payloads and ignores cancelled-shaped junk', () => {
    expect(parseStemAuditMemberships([
      {
        runId: RUN_A.id,
        title: RUN_A.title,
        runStatus: 'active',
        targetStatus: 'failed',
        result: null,
        createdAt: RUN_A.created_at,
        why: 'revision conflict',
      },
      {
        runId: RUN_B.id,
        title: RUN_B.title,
        runStatus: 'cancelled',
        targetStatus: 'pending',
      },
    ])).toEqual([
      {
        runId: RUN_A.id,
        title: RUN_A.title,
        runStatus: 'active',
        targetStatus: 'failed',
        result: null,
        createdAt: RUN_A.created_at,
        why: 'revision conflict',
      },
    ])
  })
})
