'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { RichTextEditor, type JSONContent } from '@altitutor/ui';
import {
  type ResourceSidebarItem,
  ResourcesSidebar,
} from '@/features/resources/components/resources-sidebar';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorCardCn, tutorClickableCardHoverCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';
import {
  useTutorDocumentationDocument,
  useTutorDocumentationDocuments,
  useTutorDocumentationFolders,
} from '../hooks/useDocumentation';
import type {
  TutorDocumentationDocument,
  TutorDocumentationFolder,
} from '../api/documentation';

type FolderNode = TutorDocumentationFolder & {
  documents: TutorDocumentationDocument[];
  children: FolderNode[];
};

function buildFolderNodes(
  folders: TutorDocumentationFolder[],
  documents: TutorDocumentationDocument[],
  selectedDocumentId: string | null,
): ResourceSidebarItem[] {
  const folderMap = new Map<string, FolderNode>();
  folders.forEach((folder) => {
    folderMap.set(folder.id, { ...folder, documents: [], children: [] });
  });

  const rootFolders: FolderNode[] = [];
  folderMap.forEach((folder) => {
    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      folderMap.get(folder.parent_id)?.children.push(folder);
    } else {
      rootFolders.push(folder);
    }
  });

  const rootDocuments: TutorDocumentationDocument[] = [];
  documents.forEach((document) => {
    if (document.folder_id && folderMap.has(document.folder_id)) {
      folderMap.get(document.folder_id)?.documents.push(document);
    } else {
      rootDocuments.push(document);
    }
  });

  const toDocumentItem = (document: TutorDocumentationDocument): ResourceSidebarItem => ({
    key: document.id,
    label: document.title || 'Untitled',
    href: `/documentation/${document.id}`,
    active: document.id === selectedDocumentId,
  });

  const toFolderItem = (folder: FolderNode): ResourceSidebarItem => ({
    key: folder.id,
    label: folder.name,
    children: [
      ...folder.children
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map(toFolderItem),
      ...folder.documents
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
        .map(toDocumentItem),
    ],
  });

  return [
    ...rootFolders
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map(toFolderItem),
    ...rootDocuments
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      .map(toDocumentItem),
  ];
}

function DocumentCards({ documents }: { documents: TutorDocumentationDocument[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {documents.map((document) => (
        <Link
          key={document.id}
          href={`/documentation/${document.id}`}
          className={cn(tutorCardCn('group flex items-start gap-3 p-4'), tutorClickableCardHoverCn)}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/65 text-muted-foreground">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{document.title || 'Untitled'}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Updated {new Date(document.updated_at).toLocaleDateString()}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function TutorDocumentationPage({
  selectedDocumentId = null,
}: {
  selectedDocumentId?: string | null;
}) {
  const foldersQuery = useTutorDocumentationFolders();
  const documentsQuery = useTutorDocumentationDocuments();
  const selectedDocumentQuery = useTutorDocumentationDocument(selectedDocumentId);

  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const sidebarItems = useMemo(
    () => buildFolderNodes(foldersQuery.data ?? [], documents, selectedDocumentId),
    [documents, foldersQuery.data, selectedDocumentId],
  );

  const isLoading = foldersQuery.isLoading || documentsQuery.isLoading;
  const selectedDocument = selectedDocumentId
    ? selectedDocumentQuery.data ?? null
    : null;

  return (
    <TutorPageContainer className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ResourcesSidebar title="Folders" items={sidebarItems} />

        <main className="min-w-0">
          {isLoading ? (
            <div className={tutorCardCn('h-72 animate-pulse bg-muted/35')} />
          ) : selectedDocumentId ? (
            selectedDocumentQuery.isLoading ? (
              <div className={tutorCardCn('h-72 animate-pulse bg-muted/35')} />
            ) : selectedDocument ? (
              <article className={tutorCardCn('min-h-[60vh] p-5 sm:p-8')}>
                <h2 className="mb-8 text-2xl font-semibold tracking-tight">
                  {selectedDocument.title || 'Untitled'}
                </h2>
                <div className="min-h-0">
                  <RichTextEditor
                    content={selectedDocument.content as JSONContent | null}
                    editable={false}
                    minHeight="0px"
                  />
                </div>
              </article>
            ) : (
              <div className={tutorCardCn('p-8 text-center text-sm text-muted-foreground')}>
                Document not found.
              </div>
            )
          ) : documents.length > 0 ? (
            <DocumentCards documents={documents} />
          ) : (
            <div className={tutorCardCn('p-8 text-center text-sm text-muted-foreground')}>
              No documentation is available.
            </div>
          )}
        </main>
      </div>
    </TutorPageContainer>
  );
}
