import {
  applyAuditRunStatus,
  applyAuditTargetLabels,
  applyAuditTargetStatus,
  type AuditDetail,
  type AuditTarget,
} from '../audits'

function target(overrides: Partial<AuditTarget> & Pick<AuditTarget, 'id' | 'status'>): AuditTarget {
  return {
    contentType: 'stem',
    contentId: overrides.contentId ?? overrides.id,
    label: null,
    result: null,
    outcome: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  }
}

function detail(targets: AuditTarget[]): AuditDetail {
  return {
    run: {
      id: 'run-1',
      title: 'All draft stems',
      brief: null,
      status: 'active',
      publishedWriteMode: 'proposal_only',
      workflowId: null,
      workflowVersion: null,
      createdAt: '2026-08-20T00:00:00.000Z',
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      targetCounts: {
        pending: targets.filter((item) => item.status === 'pending').length,
        in_progress: 0,
        completed: targets.filter((item) => item.status === 'completed').length,
        failed: 0,
        skipped: 0,
      },
    },
    targets,
  }
}

describe('audit board cache updates', () => {
  it('moves a target between statuses without dropping other targets', () => {
    const pending = target({ id: 't1', status: 'pending' })
    const completed = target({ id: 't2', status: 'completed', result: 'updated' })
    const next = applyAuditTargetStatus(detail([pending, completed]), 't1', 'completed')

    expect(next.targets.map((item) => `${item.id}:${item.status}`)).toEqual([
      't1:completed',
      't2:completed',
    ])
    expect(next.run.targetCounts).toMatchObject({ pending: 0, completed: 2 })
  })

  it('fills labels onto the current cache without resetting statuses', () => {
    const moved = applyAuditTargetStatus(
      detail([target({ id: 't1', contentId: 'stem-1', status: 'pending' })]),
      't1',
      'failed',
    )
    const labelled = applyAuditTargetLabels(
      moved,
      new Map([['stem:stem-1', 'A kidney passage']]),
    )

    expect(labelled.targets[0]).toMatchObject({
      status: 'failed',
      label: 'A kidney passage',
    })
  })

  it('moves the audit run between lifecycle statuses', () => {
    const run = detail([]).run
    expect(applyAuditRunStatus(run, 'completed').status).toBe('completed')
    expect(applyAuditRunStatus(run, 'completed').completedAt).toEqual(expect.any(String))
    expect(applyAuditRunStatus(run, 'cancelled').cancelledAt).toEqual(expect.any(String))
    expect(applyAuditRunStatus(run, 'cancelled').completedAt).toBeNull()
  })
})
