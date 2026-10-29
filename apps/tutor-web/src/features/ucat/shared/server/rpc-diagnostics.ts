type Workload = {
  stems?: number
  questions?: number
  options?: number
  feedbackQuestions?: number
}

export async function observeUcatRpc<Result extends { error: unknown }>(
  operation: 'bulk_import_write' | 'bulk_import_match' | 'reconciliation_content_issues',
  workload: Workload,
  run: () => PromiseLike<Result>,
): Promise<Result> {
  const started = performance.now()
  const report = (error: unknown, outcome: 'returned_error' | 'thrown_error') => {
    try {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null
      const knownCodes = ['57014', '42501', '40001', '40P01', '23505', '23514']
      console.error('[DEBUG-ucat-rpc-v1]', {
        version: 1,
        operation,
        outcome,
        code: typeof code === 'string' && knownCodes.includes(code) ? code : 'other',
        elapsed_ms: boundedCount(performance.now() - started),
        stems: boundedCount(workload.stems),
        questions: boundedCount(workload.questions),
        options: boundedCount(workload.options),
        feedback_questions: boundedCount(workload.feedbackQuestions),
      })
    } catch {
      // The probe must never change RPC results or retry semantics.
    }
  }
  let result: Result
  try {
    result = await run()
  } catch (error: unknown) {
    report(error, 'thrown_error')
    throw error
  }
  if (result.error) report(result.error, 'returned_error')
  return result
}

function boundedCount(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1_000_000_000, Math.max(0, Math.round(value)))
    : null
}
