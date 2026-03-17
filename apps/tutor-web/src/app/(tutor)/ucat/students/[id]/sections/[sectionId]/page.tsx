import { fetchUcatStudentName } from '@/features/ucat/students/lib/fetch-student-name'
import { SectionProgressPage } from '@/features/ucat/students/progress'

export default async function SectionProgressRoute({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>
}) {
  const { id, sectionId } = await params
  const basePath = `/ucat/students/${id}`
  const studentName = await fetchUcatStudentName(id)

  return (
    <SectionProgressPage
      studentId={id}
      sectionId={sectionId}
      basePath={basePath}
      studentName={studentName}
    />
  )
}
