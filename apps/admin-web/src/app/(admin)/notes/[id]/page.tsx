import { redirect } from 'next/navigation';

export default function LegacyNoteDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/documents/${params.id}`);
}
