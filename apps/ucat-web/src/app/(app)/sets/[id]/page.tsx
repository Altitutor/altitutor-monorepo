import { SetDetailPage } from '@/features/sets'

export default function SetDetailRoute({ params }: { params: { id: string } }) {
  return <SetDetailPage setId={params.id} />
}

