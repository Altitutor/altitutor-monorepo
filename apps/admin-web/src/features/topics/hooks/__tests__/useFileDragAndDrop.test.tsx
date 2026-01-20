/**
 * Tests for useFileDragAndDrop hook
 * Tests drag-and-drop logic for file items
 */

import { renderHook, act } from '@testing-library/react';
import { useFileDragAndDrop } from '../useFileDragAndDrop';
import type { FileItem } from '../../utils/fileItemHelpers';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

describe('useFileDragAndDrop', () => {
  const createMockDragStartEvent = (id: string): DragStartEvent => ({
    active: { id, data: { current: {} } },
    collisions: null,
    delta: { x: 0, y: 0 },
    activatorEvent: new MouseEvent('mousedown') as unknown as PointerEvent,
  } as unknown as DragStartEvent);

  const createMockDragEndEvent = (activeId: string, overId: string | null): DragEndEvent => ({
    active: { id: activeId, data: { current: {} } },
    over: overId ? { id: overId, data: { current: {} } } : null,
    collisions: null,
    delta: { x: 0, y: 0 },
  } as DragEndEvent);

  it('should initialize with null activeId', () => {
    const fileItems: FileItem[] = [];
    const updateFileSolution = jest.fn();
    const reorderFiles = jest.fn();

    const { result } = renderHook(() =>
      useFileDragAndDrop({
        fileItems,
        updateFileSolution,
        reorderFiles,
      })
    );

    expect(result.current.activeId).toBeNull();
  });

  it('should set activeId on drag start', () => {
    const fileItems: FileItem[] = [
      { id: '1', file: new File([''], 'test.pdf'), index: 1, solutionOfId: null },
    ];
    const updateFileSolution = jest.fn();
    const reorderFiles = jest.fn();

    const { result } = renderHook(() =>
      useFileDragAndDrop({
        fileItems,
        updateFileSolution,
        reorderFiles,
      })
    );

    act(() => {
      result.current.handleDragStart(createMockDragStartEvent('1'));
    });

    expect(result.current.activeId).toBe('1');
  });

  it('should handle dropping in solutions column', () => {
    const fileItems: FileItem[] = [
      { id: '1', file: new File([''], 'question.pdf'), index: 1, solutionOfId: null },
      { id: '2', file: new File([''], 'solution.pdf'), index: 2, solutionOfId: null },
    ];
    const updateFileSolution = jest.fn();
    const reorderFiles = jest.fn();

    const { result } = renderHook(() =>
      useFileDragAndDrop({
        fileItems,
        updateFileSolution,
        reorderFiles,
      })
    );

    act(() => {
      result.current.handleDragStart(createMockDragStartEvent('2'));
      result.current.handleDragEnd(createMockDragEndEvent('2', 'solutions-column-1'));
    });

    expect(updateFileSolution).toHaveBeenCalledWith('2', '1');
    expect(reorderFiles).not.toHaveBeenCalled();
    expect(result.current.activeId).toBeNull();
  });

  it('should not set solution if dropping on same file', () => {
    const fileItems: FileItem[] = [
      { id: '1', file: new File([''], 'question.pdf'), index: 1, solutionOfId: null },
    ];
    const updateFileSolution = jest.fn();
    const reorderFiles = jest.fn();

    const { result } = renderHook(() =>
      useFileDragAndDrop({
        fileItems,
        updateFileSolution,
        reorderFiles,
      })
    );

    act(() => {
      result.current.handleDragStart(createMockDragStartEvent('1'));
      result.current.handleDragEnd(createMockDragEndEvent('1', 'solutions-column-1'));
    });

    // Should not call updateFileSolution when dropping on itself
    expect(updateFileSolution).not.toHaveBeenCalled();
  });

  it('should handle dropping back to files column', () => {
    const fileItems: FileItem[] = [
      { id: '1', file: new File([''], 'question.pdf'), index: 1, solutionOfId: null },
      { id: '2', file: new File([''], 'solution.pdf'), index: 2, solutionOfId: '1' },
    ];
    const updateFileSolution = jest.fn();
    const reorderFiles = jest.fn();

    const { result } = renderHook(() =>
      useFileDragAndDrop({
        fileItems,
        updateFileSolution,
        reorderFiles,
      })
    );

    act(() => {
      result.current.handleDragStart(createMockDragStartEvent('2'));
      result.current.handleDragEnd(createMockDragEndEvent('2', 'files-column'));
    });

    expect(updateFileSolution).toHaveBeenCalledWith('2', null);
    expect(reorderFiles).not.toHaveBeenCalled();
    expect(result.current.activeId).toBeNull();
  });

  it('should handle reordering files', () => {
    const fileItems: FileItem[] = [
      { id: '1', file: new File([''], 'test1.pdf'), index: 1, solutionOfId: null },
      { id: '2', file: new File([''], 'test2.pdf'), index: 2, solutionOfId: null },
    ];
    const updateFileSolution = jest.fn();
    const reorderFiles = jest.fn();

    const { result } = renderHook(() =>
      useFileDragAndDrop({
        fileItems,
        updateFileSolution,
        reorderFiles,
      })
    );

    act(() => {
      result.current.handleDragStart(createMockDragStartEvent('1'));
      result.current.handleDragEnd(createMockDragEndEvent('1', '2'));
    });

    expect(reorderFiles).toHaveBeenCalledWith('1', '2');
    expect(updateFileSolution).not.toHaveBeenCalled();
    expect(result.current.activeId).toBeNull();
  });

  it('should reset activeId when drag ends with no over target', () => {
    const fileItems: FileItem[] = [
      { id: '1', file: new File([''], 'test.pdf'), index: 1, solutionOfId: null },
    ];
    const updateFileSolution = jest.fn();
    const reorderFiles = jest.fn();

    const { result } = renderHook(() =>
      useFileDragAndDrop({
        fileItems,
        updateFileSolution,
        reorderFiles,
      })
    );

    act(() => {
      result.current.handleDragStart(createMockDragStartEvent('1'));
    });
    
    expect(result.current.activeId).toBe('1');

    act(() => {
      result.current.handleDragEnd(createMockDragEndEvent('1', null));
    });

    expect(result.current.activeId).toBeNull();
    expect(updateFileSolution).not.toHaveBeenCalled();
    expect(reorderFiles).not.toHaveBeenCalled();
  });

  it('should not update solution if target file does not exist', () => {
    const fileItems: FileItem[] = [
      { id: '1', file: new File([''], 'test.pdf'), index: 1, solutionOfId: null },
    ];
    const updateFileSolution = jest.fn();
    const reorderFiles = jest.fn();

    const { result } = renderHook(() =>
      useFileDragAndDrop({
        fileItems,
        updateFileSolution,
        reorderFiles,
      })
    );

    act(() => {
      result.current.handleDragStart(createMockDragStartEvent('1'));
      result.current.handleDragEnd(createMockDragEndEvent('1', 'solutions-column-nonexistent'));
    });

    // Should not call updateFileSolution if target doesn't exist
    expect(updateFileSolution).not.toHaveBeenCalled();
  });
});
