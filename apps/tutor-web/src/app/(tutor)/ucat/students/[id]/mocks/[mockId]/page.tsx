import { fetchUcatStudentName } from '@/features/ucat/students/lib/fetch-student-name'
import { MockAttemptDetailPage } from '@/features/ucat/students/progress'

export default async function MockAttemptDetailRoute({
  params,
}: {
  params: Promise<{ id: string; mockId: string }>
}) {
  const { id, mockId } = await params
  const basePath = `/ucat/students/${id}`
  const studentName = await fetchUcatStudentName(id)

  return (
    <MockAttemptDetailPage
      studentId={id}
      mockAttemptId={mockId}
      basePath={basePath}
      studentName={studentName}
    />
  )
}
