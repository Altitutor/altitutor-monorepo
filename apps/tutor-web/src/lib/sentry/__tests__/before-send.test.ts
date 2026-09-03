import { filterExpectedTutorWebError } from '../before-send'

describe('filterExpectedTutorWebError', () => {
  it.each([
    'delete_blocked_by_dependency',
    'published_content_invalid:[{"code":"missing_category"}]',
    'public_set_contains_private_stem',
    'audit_target_not_in_progress',
  ])('drops the expected UCAT domain outcome %s', (message) => {
    const event = { exception: { values: [{ value: message }] } }

    expect(filterExpectedTutorWebError(event)).toBeNull()
  })

  it('keeps unexpected database failures', () => {
    const event = { exception: { values: [{ value: 'permission denied for table tutors' }] } }

    expect(filterExpectedTutorWebError(event)).toBe(event)
  })
})
