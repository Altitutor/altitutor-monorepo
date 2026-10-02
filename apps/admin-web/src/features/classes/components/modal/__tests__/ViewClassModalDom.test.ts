import { renderHook, waitFor } from '@testing-library/react';
import { useEntityPageRequest } from '@/shared/hooks/useEntityPageRequest';
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/classes', useSearchParams: () => new URLSearchParams() }));
beforeEach(() => push.mockClear());
test('legacy class selection navigates to its page and releases the selection', async () => {
  const close = jest.fn();
  renderHook(() => useEntityPageRequest(true, '/classes/class-id', close));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/classes/class-id', undefined));
  expect(close).toHaveBeenCalledTimes(1);
});
test('closed selections do not navigate', () => {
  renderHook(() => useEntityPageRequest(false, '/classes/class-id', jest.fn()));
  expect(push).not.toHaveBeenCalled();
});
