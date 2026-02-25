import { UcatMockDetailPage } from '@/features/ucat/mocks/components/UcatMockDetailPage'

export default async function UcatMockDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <UcatMockDetailPage mockId={id} />
}
