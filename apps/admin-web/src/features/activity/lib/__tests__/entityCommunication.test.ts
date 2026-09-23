import {
  contactSourceId,
  defaultCommunicationSources,
  defaultRecipientId,
  groupConversationSourceId,
  messageSourceId,
  sourcesAfterRecipientChange,
} from '../entityCommunication';

const student = {
  id: 'student-contact',
  kind: 'student' as const,
  label: 'Alex Student',
  isCurrent: true,
};
const historicalStudent = {
  id: 'old-student-contact',
  kind: 'student' as const,
  label: 'Alex Student',
  isCurrent: false,
};
const parent = {
  id: 'parent-contact',
  kind: 'parent' as const,
  label: 'Pat Parent',
  isCurrent: true,
};

describe('entity communication defaults', () => {
  it('leaves linked parents unselected on a student', () => {
    expect(
      defaultCommunicationSources({
        entityType: 'student',
        contacts: [student, historicalStudent, parent],
      }),
    ).toEqual(['events', contactSourceId('student-contact')]);
    expect(
      defaultRecipientId({
        entityType: 'student',
        contacts: [historicalStudent, parent, student],
      }),
    ).toBe('student-contact');
  });

  it('selects the parent when the panel is the parent', () => {
    expect(
      defaultCommunicationSources({
        entityType: 'parent',
        contacts: [parent],
      }),
    ).toEqual(['events', contactSourceId('parent-contact')]);
    expect(defaultRecipientId({ entityType: 'parent', contacts: [parent] })).toBe('parent-contact');
  });

  it('tags each number and group separately', () => {
    expect(
      messageSourceId({
        conversation: { id: 'conv', contactId: parent.id, isGroup: false },
        contact: parent,
      }),
    ).toBe(contactSourceId(parent.id));
    expect(
      messageSourceId({
        conversation: { id: 'group-1', contactId: null, isGroup: true },
        contact: null,
      }),
    ).toBe(groupConversationSourceId('group-1'));
  });

  it('narrows messages to the chosen number and keeps activity and email', () => {
    expect(
      sourcesAfterRecipientChange(
        ['events', 'email', contactSourceId(student.id), contactSourceId(parent.id)],
        contactSourceId(parent.id),
      ),
    ).toEqual(['events', 'email', contactSourceId(parent.id)]);
  });
});
