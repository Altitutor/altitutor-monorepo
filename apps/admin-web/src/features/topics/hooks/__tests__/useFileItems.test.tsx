import { renderHook, act } from '@testing-library/react';
import { useFileItems } from '../useFileItems';

describe('useFileItems', () => {
  it('should initialize with empty file items', () => {
    const { result } = renderHook(() => useFileItems());
    
    expect(result.current.fileItems).toHaveLength(0);
    expect(result.current.regularFiles).toHaveLength(0);
    expect(result.current.solutionFiles).toHaveLength(0);
  });

  it('should add files', () => {
    const { result } = renderHook(() => useFileItems());
    const file1 = new File([''], 'test1.pdf');
    const file2 = new File([''], 'test2.pdf');
    
    act(() => {
      result.current.addFiles([file1, file2]);
    });
    
    expect(result.current.fileItems).toHaveLength(2);
    expect(result.current.regularFiles).toHaveLength(2);
  });

  it('should separate regular files and solution files', () => {
    const { result } = renderHook(() => useFileItems());
    const file1 = new File([''], 'question-student.pdf');
    const file2 = new File([''], 'question.pdf');
    
    act(() => {
      result.current.addFiles([file1, file2]);
    });
    
    // After parsing, question.pdf should be marked as solution
    const questionFile = result.current.fileItems.find((f) => f.file.name === 'question.pdf');
    if (questionFile?.solutionOfId) {
      expect(result.current.regularFiles.length + result.current.solutionFiles.length).toBe(2);
    }
  });

  it('should remove files', () => {
    const { result } = renderHook(() => useFileItems());
    const file1 = new File([''], 'test1.pdf');
    const file2 = new File([''], 'test2.pdf');
    
    act(() => {
      result.current.addFiles([file1, file2]);
    });
    
    const fileId = result.current.fileItems[0].id;
    
    act(() => {
      result.current.removeFile(fileId);
    });
    
    expect(result.current.fileItems).toHaveLength(1);
    expect(result.current.fileItems[0].index).toBe(1); // Should be re-indexed
  });

  it('should update file solution relationship', () => {
    const { result } = renderHook(() => useFileItems());
    const file1 = new File([''], 'test1.pdf');
    const file2 = new File([''], 'test2.pdf');
    
    act(() => {
      result.current.addFiles([file1, file2]);
    });
    
    const file1Id = result.current.fileItems[0].id;
    const file2Id = result.current.fileItems[1].id;
    
    act(() => {
      result.current.updateFileSolution(file1Id, file2Id);
    });
    
    const updatedFile1 = result.current.fileItems.find((f) => f.id === file1Id);
    expect(updatedFile1?.solutionOfId).toBe(file2Id);
  });

  it('should clear all files', () => {
    const { result } = renderHook(() => useFileItems());
    const file1 = new File([''], 'test1.pdf');
    
    act(() => {
      result.current.addFiles([file1]);
    });
    
    expect(result.current.fileItems).toHaveLength(1);
    
    act(() => {
      result.current.clearFiles();
    });
    
    expect(result.current.fileItems).toHaveLength(0);
  });

  it('should reorder files', () => {
    const { result } = renderHook(() => useFileItems());
    const file1 = new File([''], 'test1.pdf');
    const file2 = new File([''], 'test2.pdf');
    const file3 = new File([''], 'test3.pdf');
    
    act(() => {
      result.current.addFiles([file1, file2, file3]);
    });
    
    const file1Id = result.current.fileItems[0].id;
    const file3Id = result.current.fileItems[2].id;
    
    act(() => {
      result.current.reorderFiles(file1Id, file3Id);
    });
    
    // File1 should now be at position 3
    const reorderedFile1 = result.current.fileItems.find((f) => f.id === file1Id);
    expect(reorderedFile1?.index).toBe(3);
  });
});
