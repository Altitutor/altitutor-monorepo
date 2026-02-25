'use client'

import { UcatStudentDetailPage } from '@/features/ucat'

export default function UcatStudentDetailRoute({ params }: { params: { id: string } }) {
  return <UcatStudentDetailPage studentId={params.id} />
}
