import { observeUcatRpc } from '../rpc-diagnostics'

afterEach(() => jest.restoreAllMocks())

it('records failed RPC workload and duration without copying private error or payload data', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValueOnce(8010)
  const error = { code: '57014', message: 'private question text', details: 'private student identifier' }
  const result = { data: null, error }
  expect(await observeUcatRpc('bulk_import_write', { stems: 25, questions: 100, options: 400 }, () => Promise.resolve(result))).toBe(result)
  expect(log).toHaveBeenCalledWith('[DEBUG-ucat-rpc-v1]', {
    version: 1, operation: 'bulk_import_write', outcome: 'returned_error',
    code: '57014', elapsed_ms: 8000, stems: 25, questions: 100, options: 400, feedback_questions: null,
  })
  expect(JSON.stringify(log.mock.calls)).not.toContain('private')
})

it('preserves thrown failures, emits once and excludes unrecognized error codes', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  const error = { code: 'private-token', message: 'private-data' }
  await expect(observeUcatRpc('bulk_import_match', { stems: 12 }, () => Promise.reject(error))).rejects.toBe(error)
  expect(log).toHaveBeenCalledTimes(1)
  expect(log).toHaveBeenCalledWith('[DEBUG-ucat-rpc-v1]', expect.objectContaining({
    outcome: 'thrown_error', code: 'other', stems: 12,
  }))
  expect(JSON.stringify(log.mock.calls)).not.toContain('private')
})

it('preserves successful results and emits nothing', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  const result = { data: ['private-id'], error: null }
  expect(await observeUcatRpc('reconciliation_content_issues', { feedbackQuestions: 3 }, () => Promise.resolve(result))).toBe(result)
  expect(log).not.toHaveBeenCalled()
})

it('does not let the diagnostic sink replace an RPC result or exception', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => { throw new Error('sink unavailable') })
  const error = new Error('original failure')
  const result = { data: null, error }
  expect(await observeUcatRpc('bulk_import_write', {}, () => Promise.resolve(result))).toBe(result)
  await expect(observeUcatRpc('bulk_import_write', {}, () => Promise.reject(error))).rejects.toBe(error)
})

it('projects only bounded numeric workload fields even if callers pass extra runtime values', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  const workload = { stems: Infinity, questions: -12, options: 1e20, feedbackQuestions: NaN, secret: 'private-value' }
  await observeUcatRpc('reconciliation_content_issues', workload, () => Promise.resolve({ error: { code: '42501' } }))
  expect(log).toHaveBeenCalledWith('[DEBUG-ucat-rpc-v1]', expect.objectContaining({
    stems: null, questions: 0, options: 1_000_000_000, feedback_questions: null,
  }))
  expect(JSON.stringify(log.mock.calls)).not.toContain('private')
})
