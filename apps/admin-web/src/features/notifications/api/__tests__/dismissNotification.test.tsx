import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDismissNotification } from '../mutations';
import { notificationsApi } from '../notifications';
import { notificationsKeys } from '../queryKeys';
import type { Notification } from '../../types';

const mockToast = jest.fn();
jest.mock('@altitutor/ui', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('../notifications', () => ({ notificationsApi: { dismissNotification: jest.fn() } }));
const dismiss = jest.mocked(notificationsApi.dismissNotification);

function notification(id: string, read = false): Notification {
  return {
    id, title: id, staff_id: 'staff', student_id: null, read_at: read ? '2026-10-06' : null,
    action_url: null, activity_event_id: null, app_scope: 'staff_web', body: null,
    created_at: '2026-10-06', created_by_staff_id: null, dedupe_key: null,
    dismissed_at: null, domain_event_id: null, expires_at: null, metadata: {},
    notification_type: 'TAG', priority: 'NORMAL', resolved_at: null, updated_at: '2026-10-06',
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function setup(items: Notification[]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const listKey = notificationsKeys.notifications('staff');
  const countKey = notificationsKeys.unreadCount('staff');
  client.setQueryData(listKey, items);
  client.setQueryData(countKey, items.filter((item) => !item.read_at).length);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useDismissNotification(), { wrapper });
  return { ...hook, client, listKey, countKey };
}

beforeEach(() => jest.clearAllMocks());

it('removes an unread notification and updates its badge before the database responds', async () => {
  const save = deferred();
  dismiss.mockReturnValue(save.promise);
  const { result, client, listKey, countKey } = setup([notification('first'), notification('second')]);
  act(() => result.current.mutate({ notificationId: 'first', staffId: 'staff' }));
  await waitFor(() => expect(client.getQueryData(listKey)).toEqual([notification('second')]));
  expect(client.getQueryData(countKey)).toBe(1);
  expect(result.current.isPending).toBe(true);
  await act(async () => save.resolve());
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(client.getQueryData(listKey)).toEqual([notification('second')]);
});

it('does not reduce the unread badge when dismissing a read notification', async () => {
  dismiss.mockResolvedValue(undefined);
  const { result, client, countKey } = setup([notification('read', true), notification('unread')]);
  await act(async () => { await result.current.mutateAsync({ notificationId: 'read', staffId: 'staff' }); });
  expect(client.getQueryData(countKey)).toBe(1);
});

it('restores only a failed dismissal when another dismissal succeeds', async () => {
  const first = deferred();
  const second = deferred();
  dismiss.mockImplementation((id) => id === 'first' ? first.promise : second.promise);
  const { result, client, listKey, countKey } = setup([notification('first'), notification('second')]);
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  act(() => {
    result.current.mutate({ notificationId: 'first', staffId: 'staff' });
    result.current.mutate({ notificationId: 'second', staffId: 'staff' });
  });
  await waitFor(() => expect(client.getQueryData(listKey)).toEqual([]));
  expect(client.getQueryData(countKey)).toBe(0);
  await act(async () => second.resolve());
  await waitFor(() => expect(client.isMutating()).toBe(1));
  expect(invalidate).not.toHaveBeenCalled();
  await act(async () => first.reject(new Error('offline')));
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(client.getQueryData(listKey)).toEqual([notification('first')]);
  expect(client.getQueryData(countKey)).toBe(1);
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  expect(invalidate).toHaveBeenCalledTimes(2);
});
