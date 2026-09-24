"use client";

import { useRouter } from "next/navigation";
import { DocumentDetailView } from "./DocumentDetailView";
export function NoteDetailPage({ noteId }: { noteId: string }) {
  const router = useRouter();
  return (
    <DocumentDetailView
      key={noteId}
      noteId={noteId}
      variant="page"
      onClose={() => router.push("/documents")}
    />
  );
}
