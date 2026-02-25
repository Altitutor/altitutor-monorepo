import { redirect } from 'next/navigation'

export default async function UcatMockDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/ucat/mocks?edit=${id}`)
}
