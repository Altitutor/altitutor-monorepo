/**
 * Query keys for notes feature
 */
export const notesKeys = {
  all: ['notes'] as const,
  lists: () => [...notesKeys.all, 'list'] as const,
  list: (filters?: { folderId?: string | null; search?: string }) =>
    [...notesKeys.lists(), filters] as const,
  details: () => [...notesKeys.all, 'detail'] as const,
  detail: (id: string) => [...notesKeys.details(), id] as const,
};

export const foldersKeys = {
  all: ['folders'] as const,
  lists: () => [...foldersKeys.all, 'list'] as const,
  list: () => [...foldersKeys.lists()] as const,
  root: () => [...foldersKeys.all, 'root'] as const,
  byParent: (parentId: string) => [...foldersKeys.all, 'parent', parentId] as const,
  tree: () => [...foldersKeys.all, 'tree'] as const,
  details: () => [...foldersKeys.all, 'detail'] as const,
  detail: (id: string) => [...foldersKeys.details(), id] as const,
};
