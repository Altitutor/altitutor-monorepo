"use client";

import { useCallback, useState } from "react";
import { Input } from "@altitutor/ui";
import { Search } from "lucide-react";
import { FolderTree } from "@/features/notes/components/FolderTree";
import { EditDocumentDialog } from "@/features/notes/components/EditDocumentDialog";
import { EditProjectDialog } from "@/features/projects/components/EditProjectDialog";
import { useUrlQueryParam } from "@/shared/hooks/useUrlQueryParam";

export function DocumentsView() {
  const [searchQuery, setSearchQuery] = useUrlQueryParam("search");
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);

  const openDocument = useCallback((noteId: string) => {
    setEditNoteId(noteId);
  }, []);

  const closeDocument = useCallback(() => {
    setEditNoteId(null);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div data-pane-toolbar className="flex-shrink-0 px-4 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search documents by title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <FolderTree
          searchQuery={searchQuery.trim()}
          onNoteClick={(noteId) => openDocument(noteId)}
          onNoteCreated={(noteId) => openDocument(noteId)}
          onProjectClick={(projectId) => setEditProjectId(projectId)}
        />
      </div>

      <EditDocumentDialog
        isOpen={!!editNoteId}
        onClose={closeDocument}
        noteId={editNoteId}
      />
      <EditProjectDialog
        isOpen={!!editProjectId}
        onClose={() => setEditProjectId(null)}
        projectId={editProjectId}
      />
    </div>
  );
}
