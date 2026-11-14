import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { FolderTreeItem, Note } from '../../types';
import { FolderTree } from '../FolderTree';

jest.mock('@/shared/hooks/usePaneNavigation', () => ({ usePaneNavigation: () => ({ router: { push: jest.fn() } }) }));
jest.mock('@/features/projects/api/queries', () => ({ useProjects: () => ({ data: [] }) }));
jest.mock('../../api/queries', () => ({
  useFolderTree: () => ({ data: [folder] }),
  useNotes: () => ({ data: [] }),
}));
jest.mock('../../hooks/useNoteMutations', () => ({
  useUpdateNote: () => ({ mutateAsync: jest.fn() }),
  useUpdateFolder: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('../../hooks/useNoteDragAndDrop', () => ({
  useNoteDragAndDrop: () => ({ activeId: null, activeType: null }),
}));
jest.mock('../FolderInlineCreateDocument', () => ({ FolderInlineCreateDocument: () => null }));
jest.mock('../DroppableFolder', () => ({ DroppableFolder: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
jest.mock('../DraggableFolder', () => ({
  DraggableFolder: ({ folder: value, onClick }: { folder: FolderTreeItem; onClick: () => void }) => <button onClick={onClick}>{value.name}</button>,
}));
jest.mock('../DraggableNote', () => ({
  DraggableNote: ({ note }: { note: Note }) => <button>{note.title}</button>,
}));

function note(title: string, updated_at: string): Note {
  return { id: title, title, updated_at, created_at: updated_at, created_by: 'staff', updated_by: null, admin_revision: 1,
    content: null, deleted_at: null, deleted_by: null, folder_id: 'folder', project_id: null, search_vector: null, is_tutor_documentation: false };
}

const folder: FolderTreeItem = {
  id: 'root', name: 'Resources', parent_id: null, admin_revision: 1,
  created_at: '', updated_at: '', created_by: 'staff', deleted_at: null, deleted_by: null,
  notes: [note('Alpha', '2026-11-14T00:00:00Z'), note('Zulu', '2026-11-10T00:00:00Z')],
  children: [{
    id: 'child', name: 'Nested', parent_id: 'root', admin_revision: 1,
    created_at: '', updated_at: '', created_by: 'staff', deleted_at: null, deleted_by: null,
    notes: [note('Nested Alpha', '2026-11-14T00:00:00Z'), note('Nested Zulu', '2026-11-10T00:00:00Z')], children: [],
  }],
};

test('display sorting orders documents inside root and nested folders and updates their direction', () => {
  const { rerender } = render(<FolderTree order={{ field: 'updated_at', direction: 'asc' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Resources' }));
  fireEvent.click(screen.getByRole('button', { name: 'Nested' }));
  const titles = () => screen.getAllByRole('button', { name: /Alpha|Zulu/ }).map((row) => row.textContent);
  expect(titles()).toEqual(['Zulu', 'Alpha', 'Nested Zulu', 'Nested Alpha']);

  rerender(<FolderTree order={{ field: 'updated_at', direction: 'desc' }} />);
  expect(titles()).toEqual(['Alpha', 'Zulu', 'Nested Alpha', 'Nested Zulu']);
});
