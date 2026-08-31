import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActivityEventDisplay } from '../../types';
import { ActivityItem } from '../ActivityItem';

const openEntity = jest.fn();

jest.mock('@/shared/contexts/EntityModalContext', () => ({
  useEntityModals: () => ({ openEntity }),
}));

function makeActivity(): ActivityEventDisplay {
  const student = {
    entityType: 'student' as const,
    entityId: '10000000-0000-4000-8000-000000000001',
    role: 'subject',
    displayName: 'Alex Student',
  };
  const session = {
    entityType: 'session' as const,
    entityId: '10000000-0000-4000-8000-000000000002',
    role: 'context',
    displayName: 'Tuesday UCAT',
  };

  return {
    id: '10000000-0000-4000-8000-000000000003',
    icon: 'x',
    iconColor: 'red',
    message: 'recorded Alex Student as absent from Tuesday UCAT',
    messageParts: [
      { kind: 'text', text: 'recorded ' },
      { kind: 'entity', text: 'Alex Student', entity: student },
      { kind: 'text', text: ' as absent from ' },
      { kind: 'entity', text: 'Tuesday UCAT', entity: session },
    ],
    timestamp: '1:46pm Sat 22 Aug 2026',
    performedAt: '2026-08-22T04:16:00.000Z',
    performedBy: {
      id: '10000000-0000-4000-8000-000000000004',
      name: 'Casey Admin',
    },
  };
}

describe('ActivityItem', () => {
  beforeEach(() => openEntity.mockClear());

  it('opens the staff actor and linked entities from their names', async () => {
    const user = userEvent.setup();
    render(<ActivityItem activity={makeActivity()} />);

    await user.click(screen.getByRole('button', { name: 'Open staff Casey Admin' }));
    await user.click(screen.getByRole('button', { name: 'Open student Alex Student' }));
    await user.click(screen.getByRole('button', { name: 'Open session Tuesday UCAT' }));

    expect(openEntity).toHaveBeenNthCalledWith(
      1,
      'staff',
      '10000000-0000-4000-8000-000000000004'
    );
    expect(openEntity).toHaveBeenNthCalledWith(
      2,
      'student',
      '10000000-0000-4000-8000-000000000001'
    );
    expect(openEntity).toHaveBeenNthCalledWith(
      3,
      'session',
      '10000000-0000-4000-8000-000000000002'
    );
  });
});
