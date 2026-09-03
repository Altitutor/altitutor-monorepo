'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { RichTextEditor, type JSONContent } from '@altitutor/ui';
import {
  ResourcesBackLink,
  ResourcesPager,
  type ResourceSidebarItem,
  ResourcesSidebar,
} from '@/features/resources';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorCardCn } from '@/shared/lib/tutor-visual';
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

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => void;
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
    kind: 'document',
  });

  const toFolderItem = (folder: FolderNode): ResourceSidebarItem | null => {
    const children = [
      ...folder.children
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map(toFolderItem)
        .filter((child): child is ResourceSidebarItem => child !== null),
      ...folder.documents
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
        .map(toDocumentItem),
    ];

    if (children.length === 0) {
      return null;
    }

    return {
      key: folder.id,
      label: folder.name,
      kind: 'folder',
      children,
    };
  };

  return [
    ...rootFolders
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map(toFolderItem)
      .filter((item): item is ResourceSidebarItem => item !== null),
    ...rootDocuments
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      .map(toDocumentItem),
  ];
}

function flattenDocumentItems(items: ResourceSidebarItem[]): Array<{ href: string; label: string }> {
  return items.flatMap((item) => {
    const current = item.href ? [{ href: item.href, label: item.label }] : [];
    return [...current, ...flattenDocumentItems(item.children ?? [])];
  });
}

export function TutorDocumentationPage({
  selectedDocumentId = null,
}: {
  selectedDocumentId?: string | null;
}) {
  const router = useRouter();
  const foldersQuery = useTutorDocumentationFolders();
  const documentsQuery = useTutorDocumentationDocuments();
  const selectedDocumentQuery = useTutorDocumentationDocument(selectedDocumentId);

  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const sidebarItems = useMemo(
    () => buildFolderNodes(foldersQuery.data ?? [], documents, selectedDocumentId),
    [documents, foldersQuery.data, selectedDocumentId],
  );
  const flatDocumentItems = useMemo(() => flattenDocumentItems(sidebarItems), [sidebarItems]);

  const isLoading = foldersQuery.isLoading || documentsQuery.isLoading;
  const selectedDocument = selectedDocumentId
    ? selectedDocumentQuery.data ?? null
    : null;
  const { prev, next } = useMemo(() => {
    if (!selectedDocumentId) return { prev: null, next: null };
    const idx = flatDocumentItems.findIndex((item) => item.href === `/documentation/${selectedDocumentId}`);
    if (idx === -1) return { prev: null, next: null };
    return {
      prev: idx > 0 ? flatDocumentItems[idx - 1] : null,
      next: idx < flatDocumentItems.length - 1 ? flatDocumentItems[idx + 1] : null,
    };
  }, [flatDocumentItems, selectedDocumentId]);

  const navigateWithTreeTransition = useCallback((href: string) => {
    const transitionDocument = document as ViewTransitionDocument;
    if (transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(() => {
        router.push(href);
      });
      return;
    }
    router.push(href);
  }, [router]);

  if (!selectedDocumentId) {
    return (
      <TutorPageContainer className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        </div>

        {isLoading ? (
          <div className={tutorCardCn('h-72 animate-pulse bg-muted/35')} />
        ) : documents.length > 0 ? (
          <div style={{ viewTransitionName: 'documentation-tree' }}>
            <ResourcesSidebar
              title="Folders"
              items={sidebarItems}
              className="lg:w-full"
              onNavigate={navigateWithTreeTransition}
            />
          </div>
        ) : (
          <div className={tutorCardCn('p-8 text-center text-sm text-muted-foreground')}>
            No documentation is available.
          </div>
        )}
      </TutorPageContainer>
    );
  }

  return (
    <TutorPageContainer className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <main className="min-w-0 flex-1 space-y-8">
          {selectedDocumentQuery.isLoading || isLoading ? (
            <div className="h-72 animate-pulse rounded-2xl bg-muted/50 ring-1 ring-black/[0.05] dark:ring-white/10" />
          ) : selectedDocument ? (
            <article className="pb-12">
              <h1 className="mb-8 text-3xl font-bold tracking-tight">
                {selectedDocument.title || 'Untitled'}
              </h1>
              <RichTextEditor
                content={selectedDocument.content as JSONContent | null}
                editable={false}
                minHeight="0px"
              />
            </article>
          ) : (
            <div className={tutorCardCn('p-8 text-center text-sm text-muted-foreground')}>
              Document not found.
            </div>
          )}
        </main>

        <div className="flex w-full flex-col gap-3 lg:sticky lg:top-6 lg:w-72 lg:shrink-0 lg:self-start">
          <ResourcesBackLink
            href="/documentation"
            label="Back to documents"
            className="hidden lg:inline-flex"
          />
          <div style={{ viewTransitionName: 'documentation-tree' }}>
            <ResourcesSidebar
              title="Folders"
              items={sidebarItems}
              onNavigate={navigateWithTreeTransition}
            />
          </div>
          <ResourcesPager prev={prev} next={next} ariaLabel="Document navigation" />
        </div>
      </div>
    </TutorPageContainer>
  );
}
