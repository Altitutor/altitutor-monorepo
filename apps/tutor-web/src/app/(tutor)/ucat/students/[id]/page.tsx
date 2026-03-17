import { ProgressPage } from '@/features/ucat/students/progress'

export default async function UcatStudentDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const basePath = `/ucat/students/${id}`
  return (
    <ProgressPage
      studentId={id}
      basePath={basePath}
    />
  )
}
