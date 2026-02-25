import { QuestionEnginePage } from '@/features/question-engine'
import { SetsListPage } from '@/features/sets'

export default function SetsRoute({
  searchParams,
}: {
  searchParams: { setId?: string; id?: string }
}) {
  const setId = searchParams.setId ?? searchParams.id
  if (setId) {
    return <QuestionEnginePage mode="set" sourceId={setId} />
  }
  return <SetsListPage />
}
