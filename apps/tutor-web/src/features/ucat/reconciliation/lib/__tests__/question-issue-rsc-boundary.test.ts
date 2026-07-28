import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const routeSource = readFileSync(
  resolve(
    process.cwd(),
    'src/app/(tutor)/ucat/reconciliation/questions/[issue]/page.tsx',
  ),
  'utf8',
)
const clientComponentSource = readFileSync(
  resolve(
    process.cwd(),
    'src/features/ucat/reconciliation/components/UcatReconciliationQuestionIssues.tsx',
  ),
  'utf8',
)
const setRouteSource = readFileSync(
  resolve(
    process.cwd(),
    'src/app/(tutor)/ucat/reconciliation/sets/[issue]/page.tsx',
  ),
  'utf8',
)

describe('question reconciliation route RSC boundary', () => {
  it('imports its callable slug validator from a server-safe module', () => {
    expect(routeSource).toContain(
      "from '@/features/ucat/reconciliation/lib/question-issue-definitions'",
    )
    expect(clientComponentSource).not.toMatch(
      /export function isQuestionIssueSlug/,
    )
  })

  it('keeps the set issue validator outside its client component', () => {
    expect(setRouteSource).toContain(
      "from '@/features/ucat/reconciliation/lib/set-issue-definitions'",
    )
  })
})
