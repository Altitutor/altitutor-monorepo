import { fetchUcatStudentName } from '@/features/ucat/students/lib/fetch-student-name'
import { SetAttemptDetailPage } from '@/features/ucat/students/progress'

export default async function SetAttemptDetailRoute({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>
}) {
  const { id, attemptId } = await params
  const basePath = `/ucat/students/${id}`
  const studentName = await fetchUcatStudentName(id)

  return (
    <SetAttemptDetailPage
      studentId={id}
      attemptId={attemptId}
      basePath={basePath}
      studentName={studentName}
    />
  )
}
