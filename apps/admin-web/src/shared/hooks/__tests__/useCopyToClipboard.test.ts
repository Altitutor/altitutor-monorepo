import { renderHook, act, waitFor } from '@testing-library/react';
import { useCopyToClipboard } from '../useCopyToClipboard';
import { useToast } from '@altitutor/ui';

jest.mock('@altitutor/ui', () => ({
  useToast: jest.fn(),
}));

const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

describe('useCopyToClipboard', () => {
  const mockToast = jest.fn();
  let mockWriteText: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockUseToast.mockReturnValue({
      toast: mockToast,
    } as any);

    mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should copy text to clipboard successfully', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('test@example.com', 'email');
    });

    expect(mockWriteText).toHaveBeenCalledWith('test@example.com');
    expect(result.current.copiedField).toBe('email');
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Copied!',
      description: 'Copied to clipboard',
    });
  });

  it('should clear copiedField after 2 seconds', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('test@example.com', 'email');
    });

    expect(result.current.copiedField).toBe('email');

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.copiedField).toBeNull();
    });
  });

  it('should not copy if text is empty', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('', 'email');
    });

    expect(mockWriteText).not.toHaveBeenCalled();
    expect(result.current.copiedField).toBeNull();
  });

  it('should not copy if text is "-"', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('-', 'email');
    });

    expect(mockWriteText).not.toHaveBeenCalled();
    expect(result.current.copiedField).toBeNull();
  });

  it('should show error toast on clipboard failure', async () => {
    const error = new Error('Clipboard write failed');
    mockWriteText.mockRejectedValue(error);

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('test@example.com', 'email');
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Failed to copy',
      description: 'Please try again',
      variant: 'destructive',
    });
    expect(result.current.copiedField).toBeNull();
  });

  it('should handle multiple copy operations', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('test@example.com', 'email');
    });

    expect(result.current.copiedField).toBe('email');

    await act(async () => {
      await result.current.copy('1234567890', 'phone');
    });

    expect(result.current.copiedField).toBe('phone');
  });
});
