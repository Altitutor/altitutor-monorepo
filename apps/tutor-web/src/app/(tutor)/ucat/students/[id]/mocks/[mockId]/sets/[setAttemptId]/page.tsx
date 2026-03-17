import { fetchUcatStudentName } from '@/features/ucat/students/lib/fetch-student-name'
import { SetAttemptDetailPage } from '@/features/ucat/students/progress'

export default async function SetInMockDetailRoute({
  params,
}: {
  params: Promise<{ id: string; mockId: string; setAttemptId: string }>
}) {
  const { id, mockId, setAttemptId } = await params
  const basePath = `/ucat/students/${id}`
  const studentName = await fetchUcatStudentName(id)

  return (
    <SetAttemptDetailPage
      studentId={id}
      attemptId={setAttemptId}
      basePath={basePath}
      mockAttemptId={mockId}
      studentName={studentName}
    />
  )
}
