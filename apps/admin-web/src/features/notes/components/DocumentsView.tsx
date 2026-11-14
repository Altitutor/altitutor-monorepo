"use client";

import { useCallback, useState } from "react";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";
import { DocumentsToolbar } from "./DocumentsToolbar";
import { defaultDocumentOrder } from "../utils/documentOrder";
import { FolderTree } from "@/features/notes/components/FolderTree";
import { EditProjectDialog } from "@/features/projects/components/EditProjectDialog";
import { useUrlQueryParam } from "@/shared/hooks/useUrlQueryParam";

export function DocumentsView() {
  const [searchQuery, setSearchQuery] = useUrlQueryParam("search");
  const [order, setOrder] = useState(defaultDocumentOrder);
  const { router } = usePaneNavigation();
  const [editProjectId, setEditProjectId] = useState<string | null>(null);

  const openDocument = useCallback((noteId: string) => {
    router.push(`/documents/${noteId}`);
  }, [router]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div data-pane-toolbar className="flex-shrink-0 px-4 py-2">
        <DocumentsToolbar search={searchQuery} onSearchChange={setSearchQuery} order={order} onOrderChange={setOrder} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <FolderTree
          searchQuery={searchQuery.trim()}
          order={order}
          onNoteClick={(noteId) => openDocument(noteId)}
          onNoteCreated={(noteId) => openDocument(noteId)}
          onProjectClick={(projectId) => setEditProjectId(projectId)}
        />
      </div>
      <EditProjectDialog
        isOpen={!!editProjectId}
        onClose={() => setEditProjectId(null)}
        projectId={editProjectId}
      />
    </div>
  );
}
