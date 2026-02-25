import { QuestionEnginePage } from '@/features/question-engine'
import { MocksListPage } from '@/features/mocks'

export default function MocksRoute({
  searchParams,
}: {
  searchParams: { mockId?: string; id?: string }
}) {
  const mockId = searchParams.mockId ?? searchParams.id
  if (mockId) {
    return <QuestionEnginePage mode="mock" sourceId={mockId} />
  }
  return <MocksListPage />
}
