export type DocumentationFolder = {
  id: string;
  name: string | null;
  parent_id: string | null;
};

export type DocumentationSummary = {
  id: string;
  title: string | null;
  folder_id: string | null;
};

type DocumentationItem = {
  kind: 'document';
  id: string;
  title: string;
};

type FolderItem = {
  kind: 'folder';
  id: string;
  title: string;
  children: DocumentationNode[];
};

export type DocumentationNode = DocumentationItem | FolderItem;

export function buildDocumentationTree(
  folders: DocumentationFolder[],
  documents: DocumentationSummary[],
): DocumentationNode[] {
  const nodes = new Map<string, FolderItem>();
  const roots: DocumentationNode[] = [];
  const byTitle = (a: DocumentationNode, b: DocumentationNode) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

  for (const folder of folders) {
    nodes.set(folder.id, {
      kind: 'folder',
      id: folder.id,
      title: folder.name || 'Untitled folder',
      children: [],
    });
  }

  for (const folder of folders) {
    const item = nodes.get(folder.id);
    if (!item) continue;
    const parent = folder.parent_id ? nodes.get(folder.parent_id) : null;
    (parent?.children ?? roots).push(item);
  }

  for (const document of documents) {
    const folder = document.folder_id ? nodes.get(document.folder_id) : null;
    (folder?.children ?? roots).push({ kind: 'document', id: document.id, title: document.title || 'Untitled' });
  }

  function sortAndPrune(items: DocumentationNode[]): DocumentationNode[] {
    const folders: FolderItem[] = [];
    const documents: DocumentationItem[] = [];

    for (const item of items) {
      if (item.kind === 'document') {
        documents.push(item);
      } else {
        const children = sortAndPrune(item.children);
        if (children.length > 0) folders.push({ ...item, children });
      }
    }

    return [...folders.sort(byTitle), ...documents.sort(byTitle)];
  }

  return sortAndPrune(roots);
}
