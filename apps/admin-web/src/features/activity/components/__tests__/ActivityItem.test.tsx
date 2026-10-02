import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActivityEventDisplay } from '../../types';
import { ActivityItem } from '../ActivityItem';

const openEntity = jest.fn();

jest.mock('@/shared/contexts/EntityNavigation', () => ({
  useEntityNavigation: () => ({ openEntity }),
}));

jest.mock('@/shared/components/NotesEditorWithMentions', () => ({
  NotesEditorWithMentions: () => <div role="textbox" aria-label="Edit note" />,
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

  it('edits and deletes note cards from the activity feed', async () => {
    const user = userEvent.setup();
    const onUpdateNote = jest.fn().mockResolvedValue(undefined);
    const onDeleteNote = jest.fn().mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const noteId = '10000000-0000-4000-8000-000000000005';
    const noteActivity: ActivityEventDisplay = {
      ...makeActivity(),
      id: '10000000-0000-4000-8000-000000000006',
      icon: 'note',
      iconColor: 'gray',
      message: 'added a note',
      entityId: noteId,
      entityType: 'note',
      eventType: 'note.added',
      noteContent: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Follow up' }] }],
      },
    };

    const { rerender } = render(
      <ActivityItem
        activity={noteActivity}
        onUpdateNote={onUpdateNote}
        onDeleteNote={onDeleteNote}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Note actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdateNote).toHaveBeenCalledWith(noteId, noteActivity.noteContent);

    rerender(
      <ActivityItem
        activity={noteActivity}
        onUpdateNote={onUpdateNote}
        onDeleteNote={onDeleteNote}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Note actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this note?');
    expect(onDeleteNote).toHaveBeenCalledWith(noteId);
    confirmSpy.mockRestore();
  });
});


it('flags and unflags entity notes using the displayed revision', async () => {
  const user = userEvent.setup();
  const onSetNoteAlert = jest.fn().mockResolvedValue(undefined);
  const activity: ActivityEventDisplay = {
    ...makeActivity(), icon: 'note', noteContent: 'Call before each session',
    entityId: 'note-id', noteTargetType: 'parents', noteRevision: 4,
  };
  const { rerender } = render(<ActivityItem activity={activity} onUpdateNote={jest.fn()} onDeleteNote={jest.fn()} onSetNoteAlert={onSetNoteAlert} />);
  await user.click(screen.getByRole('button', { name: 'Note actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Flag as alert' }));
  expect(onSetNoteAlert).toHaveBeenCalledWith('note-id', true, 4);
  rerender(<ActivityItem activity={{ ...activity, isNoteAlert: true, noteRevision: 5 }} onUpdateNote={jest.fn()} onDeleteNote={jest.fn()} onSetNoteAlert={onSetNoteAlert} />);
  expect(screen.getByText('Alert')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Note actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Remove alert flag' }));
  expect(onSetNoteAlert).toHaveBeenCalledWith('note-id', false, 5);
});

it('does not offer alerts on session notes', async () => {
  const user = userEvent.setup();
  render(<ActivityItem activity={{ ...makeActivity(), icon: 'note', noteContent: 'Session note', entityId: 'note-id', noteTargetType: 'sessions', noteRevision: 1 }} onUpdateNote={jest.fn()} onDeleteNote={jest.fn()} onSetNoteAlert={jest.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Note actions' }));
  expect(screen.queryByRole('menuitem', { name: 'Flag as alert' })).not.toBeInTheDocument();
});


it('captures the note revision when editing starts and does not advance it on refresh', async () => {
  const user = userEvent.setup();
  const onUpdateNote = jest.fn().mockResolvedValue(undefined);
  const activity: ActivityEventDisplay = { ...makeActivity(), icon: 'note', noteContent: 'Check this note', entityId: 'note-id', noteRevision: 7 };
  const { rerender } = render(<ActivityItem activity={activity} onUpdateNote={onUpdateNote} onDeleteNote={jest.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Note actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  rerender(<ActivityItem activity={{ ...activity, noteRevision: 8, isNoteAlert: true }} onUpdateNote={onUpdateNote} onDeleteNote={jest.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(onUpdateNote).toHaveBeenCalledWith('note-id', expect.any(Object), 7);
});
