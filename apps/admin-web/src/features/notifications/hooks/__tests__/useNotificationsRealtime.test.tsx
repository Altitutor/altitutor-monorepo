import { renderHook } from '@testing-library/react';
import { useNotificationsRealtime } from '../useNotificationsRealtime';

const mockToast = jest.fn();
const mockPush = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockIsMutating = jest.fn(() => 0);
const mockRemoveChannel = jest.fn();
const mockChannel = { on: jest.fn(), subscribe: jest.fn() };
const mockSupabase = { channel: jest.fn(() => mockChannel), removeChannel: mockRemoveChannel };

jest.mock('@altitutor/ui', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries, isMutating: mockIsMutating }) }));
jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: () => mockSupabase }));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsMutating.mockReturnValue(0);
  mockChannel.on.mockReturnValue(mockChannel);
  mockChannel.subscribe.mockReturnValue(mockChannel);
});

it('subscribes only to the current sender and shows a failure toast linking to the conversation', () => {
  const { unmount } = renderHook(() => useNotificationsRealtime('sender-id'));
  const [, filter, onInsert] = mockChannel.on.mock.calls[0];
  expect(filter).toMatchObject({ event: 'INSERT', filter: 'staff_id=eq.sender-id' });
  onInsert({ new: {
    notification_type: 'MESSAGE_DELIVERY_FAILED', title: 'Message to Ada failed',
    body: 'Your message could not be delivered.', action_url: '/messages?contact=ada',
  } });
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Message to Ada failed', variant: 'destructive',
  }));
  mockToast.mock.calls[0][0].action.onClick();
  expect(mockPush).toHaveBeenCalledWith('/messages?contact=ada');
  expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
  unmount();
  expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
});

it('does not show failure toasts for unrelated notifications or updates', () => {
  renderHook(() => useNotificationsRealtime('sender-id'));
  mockChannel.on.mock.calls[0][2]({ new: { notification_type: 'TAG' } });
  mockChannel.on.mock.calls[1][2]({ new: { notification_type: 'MESSAGE_DELIVERY_FAILED' } });
  expect(mockToast).not.toHaveBeenCalled();
});

it('does not subscribe without a signed-in staff member', () => {
  renderHook(() => useNotificationsRealtime(''));
  expect(mockSupabase.channel).not.toHaveBeenCalled();
});

it('defers realtime refetches while dismissals are pending', () => {
  mockIsMutating.mockReturnValue(1);
  renderHook(() => useNotificationsRealtime('sender-id'));
  mockChannel.on.mock.calls[0][2]({ new: { notification_type: 'TAG' } });
  mockChannel.on.mock.calls[1][2]({ new: {} });
  expect(mockInvalidateQueries).not.toHaveBeenCalled();
});
