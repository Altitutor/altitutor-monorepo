import { changeSchema } from '../contracts';

it('accepts an existing compact-offset due date without populating omitted task changes', () => {
  const changes = { due_date: '2026-11-01T10:30:00+0930' };

  expect(changeSchema('task').parse(changes)).toEqual(changes);
});
