import { notFound } from 'next/navigation'
import { SetDetailPage } from '@/features/sets'

type PageProps = {
  params: Promise<{ sectionNumber: string; setId: string }>
}

export default async function SetDetailSectionRoute({ params }: PageProps) {
  const { sectionNumber, setId } = await params
  const num = parseInt(sectionNumber, 10)
  if (Number.isNaN(num) || num < 1 || num > 4) {
    notFound()
  }
  return <SetDetailPage setId={setId} sectionNumber={num} />
}
