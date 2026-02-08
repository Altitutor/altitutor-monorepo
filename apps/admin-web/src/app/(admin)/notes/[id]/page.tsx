'use client';

import { NoteDetailPage } from '@/features/notes/components/NoteDetailPage';

export default function NoteDetailRoute({ params }: { params: { id: string } }) {
  return <NoteDetailPage noteId={params.id} />;
}
