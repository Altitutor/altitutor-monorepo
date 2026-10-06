import { act, render, screen, within } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';
import { DraggableFilesList, type TopicFileWithFile } from '../DraggableFilesList';

let mockDragEnd: (event: DragEndEvent) => void;
jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual<typeof import('@dnd-kit/core')>('@dnd-kit/core'),
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: typeof mockDragEnd }) => {
    mockDragEnd = onDragEnd;
    return <>{children}</>;
  },
}));

function file(id: string, options: Partial<TopicFileWithFile> = {}): TopicFileWithFile {
  return {
    id, topic_id: 'topic', file_id: id, type: 'NOTES', index: 1,
    code: id, is_solutions: false, is_solutions_of_id: null,
    created_at: '', updated_at: '', created_by: null,
    file: {
      id, filename: `${id}.pdf`, mimetype: 'application/pdf', size_bytes: 1,
      storage_path: id, external_url: null, storage_provider: 'supabase',
      bucket: 'resources', metadata: {}, created_at: '', updated_at: '',
      created_by: null, deleted_at: null,
    },
    ...options,
  };
}

function drop(activeId: string, targetFileId: string) {
  act(() => mockDragEnd({
    active: { id: activeId, data: { current: {} }, rect: { current: { initial: null, translated: null } } },
    over: {
      id: `solution-drop-${targetFileId}`,
      data: { current: { type: 'solution-drop', targetFileId } },
      rect: { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 },
      disabled: false,
    },
    activatorEvent: new Event('pointerup'),
    collisions: null,
    delta: { x: 0, y: 0 },
  }));
}

function setup(files: TopicFileWithFile[]) {
  const callbacks = { onReorder: jest.fn(), onSolutionLink: jest.fn(), onSolutionUnlink: jest.fn() };
  render(<DraggableFilesList files={files} {...callbacks} />);
  return callbacks;
}

describe('topic solution drag and drop', () => {
  it('converts a regular file dropped on the right to solutions', () => {
    const callbacks = setup([file('questions'), file('answers')]);
    drop('answers', 'questions');
    expect(callbacks.onSolutionLink).toHaveBeenCalledWith('answers', 'questions');
    expect(screen.getByText('(Solutions)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Drag answers.pdf' })).not.toBeInTheDocument();
  });

  it('moves solutions into the target type and leaves replaced solutions unlinked', () => {
    const callbacks = setup([
      file('questions', { type: 'TEST' }),
      file('old', { type: 'TEST', is_solutions: true, is_solutions_of_id: 'questions' }),
      file('answers', { is_solutions: true }),
    ]);
    drop('answers', 'questions');
    expect(callbacks.onSolutionLink).toHaveBeenCalledWith('answers', 'questions');
    expect(screen.getAllByText('answers.pdf')).toHaveLength(1);
    expect(screen.getByText('Drop file here')).toBeInTheDocument();
    const testSection = screen.getByRole('heading', { name: 'Test' }).parentElement?.parentElement;
    expect(testSection).toBeTruthy();
    expect(within(testSection!).getByText('answers.pdf')).toBeInTheDocument();
  });

  it('does not link a file to itself', () => {
    const callbacks = setup([file('questions')]);
    drop('questions', 'questions');
    expect(callbacks.onSolutionLink).not.toHaveBeenCalled();
  });

  it('does not convert a parent with linked solutions into solutions', () => {
    const callbacks = setup([
      file('questions'), file('target'),
      file('answers', { is_solutions: true, is_solutions_of_id: 'questions' }),
    ]);
    drop('questions', 'target');
    expect(callbacks.onSolutionLink).not.toHaveBeenCalled();
  });

  it('ignores a drop on the current parent', () => {
    const callbacks = setup([
      file('questions'), file('answers', { is_solutions: true, is_solutions_of_id: 'questions' }),
    ]);
    drop('answers', 'questions');
    expect(callbacks.onSolutionLink).not.toHaveBeenCalled();
  });
});
