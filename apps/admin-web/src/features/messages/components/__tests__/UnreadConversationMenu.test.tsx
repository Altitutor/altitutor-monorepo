import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnreadConversationMenu } from '../UnreadConversationMenu';
import type { AdminStaffOption } from '../../api/queries';

const staff: AdminStaffOption[] = [
  { id: 'ada', first_name: 'Ada', last_name: 'Admin' },
  { id: 'bea', first_name: 'Bea', last_name: 'Admin' },
];

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
});

it('marks a read conversation unread from the mail button', async () => {
  const onMarkUnread = jest.fn();
  render(
    <UnreadConversationMenu
      unread={false}
      staff={staff}
      assigneeId={null}
      onMarkRead={jest.fn()}
      onMarkUnread={onMarkUnread}
      onAssign={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Mark as unread' }));
  expect(onMarkUnread).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menuitem', { name: 'Assign to' })).not.toBeInTheDocument();
});

it('offers mark as read and assigns the chosen admin from the unread menu', async () => {
  const user = userEvent.setup();
  const onMarkRead = jest.fn();
  const onAssign = jest.fn();
  render(
    <UnreadConversationMenu
      unread
      staff={staff}
      assigneeId="ada"
      onMarkRead={onMarkRead}
      onMarkUnread={jest.fn()}
      onAssign={onAssign}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Conversation actions, Assigned to Ada Admin' }));
  await user.click(screen.getByRole('menuitem', { name: 'Mark as read' }));
  expect(onMarkRead).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole('button', { name: 'Conversation actions, Assigned to Ada Admin' }));
  await user.click(screen.getByRole('menuitem', { name: 'Assign to' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Bea Admin' }));
  expect(onAssign).toHaveBeenCalledWith('bea');
});
