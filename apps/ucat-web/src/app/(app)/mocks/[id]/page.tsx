import { MockDetailPage } from '@/features/mocks'

export default function MockDetailRoute({ params }: { params: { id: string } }) {
  return <MockDetailPage mockId={params.id} />
}

