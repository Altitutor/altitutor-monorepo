import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConversationRowActions } from '../ConversationRowActions';
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

it('marks a read conversation unread', async () => {
  const onMarkUnread = jest.fn();
  render(
    <div data-conversation-row>
      <ConversationRowActions
        unread={false}
        staff={staff}
        assigneeId={null}
        onMarkRead={jest.fn()}
        onMarkUnread={onMarkUnread}
        onAssign={jest.fn()}
        onCreateTask={jest.fn()}
      />
    </div>,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Mark as unread' }));
  expect(onMarkUnread).toHaveBeenCalledTimes(1);
});

it('marks an unread conversation read and assigns from a separate chip', async () => {
  const user = userEvent.setup();
  const onMarkRead = jest.fn();
  const onAssign = jest.fn();
  render(
    <ConversationRowActions
      unread
      staff={staff}
      assigneeId="ada"
      onMarkRead={onMarkRead}
      onMarkUnread={jest.fn()}
      onAssign={onAssign}
      onCreateTask={jest.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Mark as read' }));
  expect(onMarkRead).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Assign conversation, Ada Admin' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Bea Admin' }));
  expect(onAssign).toHaveBeenCalledWith('bea');
});
