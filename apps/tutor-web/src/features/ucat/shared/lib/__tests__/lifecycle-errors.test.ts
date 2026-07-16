import {
  firstUcatBulkStatusFailureError,
  readUcatBulkStatusResponse,
  UcatLifecycleError,
  lifecycleErrorToast,
  lifecycleStatusSuccessToast,
} from '@/features/ucat/shared/lifecycle-errors'

describe('bulk lifecycle status responses', () => {
  it('keeps successful IDs and structured failures from a partial result', async () => {
    const response = {
      ok: true,
      json: async () => ({
        movedIds: ['moved-id'],
        failures: [{
          contentId: 'blocked-id',
          error: 'Blocked by Mock A.',
          blockers: [{
            code: 'parent_mock',
            message: 'Blocked by Mock A.',
            entity_type: 'mock',
            entity_id: 'mock-a',
          }],
        }],
      }),
    } as Response

    const result = await readUcatBulkStatusResponse(response, 'Failed to update statuses')
    expect(result.movedIds).toEqual(['moved-id'])
    expect(result.failures).toHaveLength(1)

    const error = firstUcatBulkStatusFailureError(result)
    expect(error).toBeInstanceOf(UcatLifecycleError)
    expect(error?.message).toBe('Blocked by Mock A.')
    expect(error?.blockers[0]?.entity_id).toBe('mock-a')
  })
})

describe('lifecycleErrorToast', () => {
  it('shows a human blocker and links to its parent mock', () => {
    const navigate = jest.fn()
    const toast = lifecycleErrorToast(
      new UcatLifecycleError('This set is used by the published mock “Mock A”.', [
        {
          code: 'parent_mock',
          message: 'This set is used by the published mock “Mock A”.',
          entity_type: 'mock',
          entity_id: 'mock-a',
          entity_name: 'Mock A',
        },
      ]),
      'Cannot move set',
      navigate,
    )

    expect(toast.description).toBe('This set is used by the published mock “Mock A”.')
    expect(toast.action?.label).toBe('View mock')
    toast.action?.onClick()
    expect(navigate).toHaveBeenCalledWith('/ucat/mocks/mock-a')
  })

  it('summarises additional blockers without exposing database codes', () => {
    const toast = lifecycleErrorToast(
      new UcatLifecycleError('This mock is attached to session “Session A”.', [
        { code: 'session_attachment', message: 'Session A' },
        { code: 'session_attachment', message: 'Session B' },
      ]),
      'Cannot move mock',
      jest.fn(),
    )

    expect(toast.description).toBe('This mock is attached to session “Session A”. There is 1 more blocker.')
    expect(toast).not.toHaveProperty('action')
  })

  it('opens a parent editor when the page can host it', () => {
    const navigate = jest.fn()
    const openEntity = jest.fn(() => true)
    const toast = lifecycleErrorToast(
      new UcatLifecycleError('Blocked by Mock A.', [{
        code: 'parent_mock',
        message: 'Blocked by Mock A.',
        entity_type: 'mock',
        entity_id: 'mock-a',
      }]),
      'Cannot move set',
      navigate,
      openEntity,
    )

    expect(toast.action?.label).toBe('Edit mock')
    toast.action?.onClick()
    expect(openEntity).toHaveBeenCalledWith('mock', 'mock-a')
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('lifecycleStatusSuccessToast', () => {
  it('offers an undo action for a successful status change', () => {
    const onUndo = jest.fn()
    const toast = lifecycleStatusSuccessToast({
      contentLabel: 'Set',
      count: 2,
      status: 'in_review',
      onUndo,
    })

    expect(toast.title).toBe('2 sets moved to In review')
    expect(toast.action.label).toBe('Undo')
    toast.action.onClick()
    expect(onUndo).toHaveBeenCalled()
  })
})
