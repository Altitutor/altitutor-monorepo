import {
  failedUcatDeleteContentId,
  firstUcatBulkStatusFailureError,
  isUcatDeleteBlockedError,
  isUcatVisibilityBlockedError,
  parseUcatLifecycleBlockers,
  publicationBlockedBlockers,
  readUcatBulkStatusResponse,
  throwUcatLifecycleResponseError,
  UcatLifecycleError,
  ucatDeleteBlockedPayload,
  ucatVisibilityBlockedFallbackMessage,
  ucatVisibilityBlockedPayload,
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

  it('opens a private question from a public-set visibility block', () => {
    const navigate = jest.fn()
    const openEntity = jest.fn(() => true)
    const toast = lifecycleErrorToast(
      new UcatLifecycleError(
        'This public set contains the private question “VR passage”. Make that question public or remove it from the set first.',
        [{
          code: 'public_set_contains_private_stem',
          message: 'This public set contains the private question “VR passage”. Make that question public or remove it from the set first.',
          entity_type: 'stem',
          entity_id: 'stem-1',
          entity_name: 'VR passage',
        }],
      ),
      'Failed to save',
      navigate,
      openEntity,
    )

    expect(toast.action?.label).toBe('View question')
    toast.action?.onClick()
    expect(openEntity).toHaveBeenCalledWith('stem', 'stem-1')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('shows View set when a stem cannot be made private inside a public set', () => {
    const navigate = jest.fn()
    const openEntity = jest.fn(() => true)
    const toast = lifecycleErrorToast(
      new UcatLifecycleError(
        'Cannot make this question private while it belongs to the public set “VR 1”. Remove it from that set or make the set private first.',
        [{
          code: 'private_child_of_public_set',
          message: 'Cannot make this question private while it belongs to the public set “VR 1”. Remove it from that set or make the set private first.',
          entity_type: 'set',
          entity_id: 'set-1',
          entity_name: 'VR 1',
        }],
      ),
      'Could not update visibility',
      navigate,
      openEntity,
    )

    expect(toast.description).toContain('public set “VR 1”')
    expect(toast.action?.label).toBe('View set')
    toast.action?.onClick()
    expect(openEntity).toHaveBeenCalledWith('set', 'set-1')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('shows View mock when a set cannot be made private inside a public mock', () => {
    const navigate = jest.fn()
    const toast = lifecycleErrorToast(
      new UcatLifecycleError(
        'Cannot make this set private while it belongs to the public mock “Mock A”. Remove it from that mock or make the mock private first.',
        [{
          code: 'private_child_of_public_mock',
          message: 'Cannot make this set private while it belongs to the public mock “Mock A”. Remove it from that mock or make the mock private first.',
          entity_type: 'mock',
          entity_id: 'mock-a',
          entity_name: 'Mock A',
        }],
      ),
      'Could not update visibility',
      navigate,
    )

    expect(toast.action?.label).toBe('View mock')
    toast.action?.onClick()
    expect(navigate).toHaveBeenCalledWith('/ucat/mocks/mock-a')
  })
})

describe('delete blockers', () => {
  it('recognises dependency and session-attachment delete failures', () => {
    expect(isUcatDeleteBlockedError('delete_blocked_by_dependency')).toBe(true)
    expect(isUcatDeleteBlockedError('status_blocked_by_attachment')).toBe(true)
    expect(isUcatDeleteBlockedError('forbidden')).toBe(false)
  })

  it('reads the failing item id from a bulk delete exception', () => {
    expect(failedUcatDeleteContentId(
      'bulk_delete_item:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:delete_blocked_by_dependency',
      'fallback-id',
    )).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(failedUcatDeleteContentId('delete_blocked_by_dependency', 'fallback-id')).toBe('fallback-id')
  })

  it('parses structured blockers from a JSON array or JSON string', () => {
    const blocker = {
      code: 'parent_set',
      message: 'This question is used by the published set “VR 1”. Remove it from that set before deleting.',
      entity_type: 'set',
      entity_id: 'set-1',
      entity_name: 'VR 1',
    }
    expect(parseUcatLifecycleBlockers([blocker])[0]?.entity_id).toBe('set-1')
    expect(parseUcatLifecycleBlockers(JSON.stringify([blocker]))[0]?.entity_name).toBe('VR 1')
    expect(parseUcatLifecycleBlockers([{ code: 1 }])).toEqual([])
  })

  it('extracts publication blockers from a database exception', () => {
    const blockers = publicationBlockedBlockers(
      'publication_blocked:[{"code":"full_section_question_count_mismatch","message":"A full section set requires exactly 44 questions for its reference blueprint; found 0."}]',
    )
    expect(blockers).toEqual([{
      code: 'full_section_question_count_mismatch',
      message: 'A full section set requires exactly 44 questions for its reference blueprint; found 0.',
      entity_type: null,
      entity_id: null,
      entity_name: null,
    }])
    expect(publicationBlockedBlockers('in_review_set_contains_draft_stem')).toEqual([])
  })

  it('uses the first blocker message for the delete payload', () => {
    const payload = ucatDeleteBlockedPayload([
      {
        code: 'parent_set',
        message: 'This question is used by the published set “VR 1”. Remove it from that set before deleting.',
        entity_type: 'set',
        entity_id: 'set-1',
        entity_name: 'VR 1',
      },
    ], 'stem')
    expect(payload.error).toContain('VR 1')
    expect(payload.blockers).toHaveLength(1)
  })

  it('throws a lifecycle error with blockers from a delete API response', async () => {
    const response = {
      json: async () => ({
        error: 'This question is used by the published set “VR 1”. Remove it from that set before deleting.',
        blockers: [{
          code: 'parent_set',
          message: 'This question is used by the published set “VR 1”. Remove it from that set before deleting.',
          entity_type: 'set',
          entity_id: 'set-1',
          entity_name: 'VR 1',
        }],
      }),
    } as Response

    await expect(throwUcatLifecycleResponseError(response, 'Failed to delete question stem'))
      .rejects.toMatchObject({
        name: 'UcatLifecycleError',
        message: 'This question is used by the published set “VR 1”. Remove it from that set before deleting.',
        blockers: [{ entity_type: 'set', entity_id: 'set-1' }],
      })
  })

  it('offers Edit set on a blocked stem delete when the page can host the editor', () => {
    const navigate = jest.fn()
    const openEntity = jest.fn(() => true)
    const toast = lifecycleErrorToast(
      new UcatLifecycleError(
        'This question is used by the published set “VR 1”. Remove it from that set before deleting.',
        [{
          code: 'parent_set',
          message: 'This question is used by the published set “VR 1”. Remove it from that set before deleting.',
          entity_type: 'set',
          entity_id: 'set-1',
          entity_name: 'VR 1',
        }],
      ),
      'Cannot delete',
      navigate,
      openEntity,
    )

    expect(toast.action?.label).toBe('Edit set')
    toast.action?.onClick()
    expect(openEntity).toHaveBeenCalledWith('set', 'set-1')
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('visibility blockers', () => {
  it('recognises public-set and private-child visibility codes', () => {
    expect(isUcatVisibilityBlockedError('public_set_contains_private_stem')).toBe(true)
    expect(isUcatVisibilityBlockedError('private_child_of_public_set')).toBe(true)
    expect(isUcatVisibilityBlockedError('private_child_of_public_mock')).toBe(true)
    expect(isUcatVisibilityBlockedError('public_mock_contains_private_set')).toBe(true)
    expect(isUcatVisibilityBlockedError('delete_blocked_by_dependency')).toBe(false)
  })

  it('reads the failing item id from a bulk metadata update exception', () => {
    expect(failedUcatDeleteContentId(
      'bulk_update_item:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:private_child_of_public_set',
      'fallback-id',
    )).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('uses the first named blocker and falls back to a human explanation', () => {
    const payload = ucatVisibilityBlockedPayload([
      {
        code: 'public_set_contains_private_stem',
        message: 'This public set contains the private question “VR passage”. Make that question public or remove it from the set first.',
        entity_type: 'stem',
        entity_id: 'stem-1',
        entity_name: 'VR passage',
      },
    ], 'public_set_contains_private_stem')
    expect(payload.error).toContain('VR passage')
    expect(payload.blockers[0]?.entity_type).toBe('stem')
    expect(ucatVisibilityBlockedFallbackMessage('public_set_contains_private_stem')).toContain('private question')
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
