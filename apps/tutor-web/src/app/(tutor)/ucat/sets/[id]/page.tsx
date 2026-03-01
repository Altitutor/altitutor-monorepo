import { UcatSetDetailPage } from '@/features/ucat/sets/components/UcatSetDetailPage'

export default async function UcatSetDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <UcatSetDetailPage setId={id} />
}
