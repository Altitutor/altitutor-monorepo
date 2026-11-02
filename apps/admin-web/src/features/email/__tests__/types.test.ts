import { emailCommandSchema } from '../types';

it('keeps accepted scheduled-mail identifiers and timestamp values unchanged', () => {
  const command = {
    action: 'schedule',
    id: 'draft-1',
    changeKey: 'change-1',
    commandId: '00000000-0000-0000-0000-000000000001',
    scheduledAt: '2026-11-02T10:30+0930',
  };

  expect(emailCommandSchema.parse(command)).toEqual(command);
});
