import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardNavigationProvider } from '@altitutor/ui';
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


it('routes hovered message row shortcuts ahead of keyboard focus in another pane', () => {
  jest.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const task=jest.fn(),unread=jest.fn();
  render(<KeyboardNavigationProvider value={true}><main data-admin-main><div data-conversation-row data-testid="hover-row"><ConversationRowActions unread={false} staff={staff} assigneeId={null} onMarkRead={jest.fn()} onMarkUnread={unread} onAssign={jest.fn()} onCreateTask={task}/></div></main><aside data-accessory-tab="active"><button>Right focus</button></aside></KeyboardNavigationProvider>);
  screen.getByRole('button',{name:'Right focus'}).focus();
  fireEvent.pointerOver(screen.getByTestId('hover-row'));
  fireEvent.keyDown(document.activeElement!,{key:'t'});fireEvent.keyDown(document.activeElement!,{key:'u'});
  expect(task).toHaveBeenCalledTimes(1);expect(unread).toHaveBeenCalledTimes(1);
});
