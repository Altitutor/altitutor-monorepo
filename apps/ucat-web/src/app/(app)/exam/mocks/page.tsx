import { QuestionEnginePage } from "@/features/question-engine";

export default function ExamMocksRoute({
  searchParams,
}: {
  searchParams: { mockId?: string; id?: string };
}) {
  const mockId = searchParams.mockId ?? searchParams.id;
  return <QuestionEnginePage mode="mock" sourceId={mockId} />;
}
