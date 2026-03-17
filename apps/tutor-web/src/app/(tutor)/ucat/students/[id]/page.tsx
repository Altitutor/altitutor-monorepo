import { fetchUcatStudentName } from '@/features/ucat/students/lib/fetch-student-name'
import { ProgressPage } from '@/features/ucat/students/progress'

export default async function UcatStudentDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const basePath = `/ucat/students/${id}`
  const studentName = await fetchUcatStudentName(id)

  return (
    <ProgressPage
      studentId={id}
      basePath={basePath}
      studentName={studentName}
    />
  )
}
