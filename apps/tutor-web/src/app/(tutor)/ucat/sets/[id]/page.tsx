import { redirect } from 'next/navigation'

export default async function UcatSetDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/ucat/sets?edit=${id}`)
}
