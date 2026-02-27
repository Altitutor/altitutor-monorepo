import { QuestionEnginePage } from '@/features/question-engine'

export default function ExamSetsRoute({
  searchParams,
}: {
  searchParams: { setId?: string; id?: string }
}) {
  const setId = searchParams.setId ?? searchParams.id
  return <QuestionEnginePage mode="set" sourceId={setId} />
}

