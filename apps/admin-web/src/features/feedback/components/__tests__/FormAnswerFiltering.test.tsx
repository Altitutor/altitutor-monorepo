import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormResponsesPage } from '../FormResponsesPage';
import { FormReportsPage } from '../FormReportsPage';
import { responses } from './answer-filter-fixtures';

const originalFetch = global.fetch;
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = jest.fn();
  HTMLElement.prototype.hasPointerCapture = jest.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = jest.fn();
});
beforeEach(() => {
  global.fetch = jest.fn(async (input) => {
    const url = String(input);
    const json = url.includes('/reports') ? { report: {
      responses, responseCount: 2,
      answers: responses.flatMap((response) => response.form_response_answers!.map((answer) => ({ ...answer, response, reporting_question_id: answer.question_id }))),
    } } : url.includes('/responses') ? { responses } : { forms: [{ id: 'feedback', name: 'Student feedback' }] };
    return { ok: true, json: async () => json } as Response;
  });
});
afterEach(() => { cleanup(); global.fetch = originalFetch; });

it.each([['Responses', FormResponsesPage], ['Reports', FormReportsPage]] as const)(
  '%s filters by a specific text answer and can clear the condition', async (_name, Page) => {
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Display options' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Filter Student feedback · Q1: How was it?' }));
    const input = screen.queryByRole('textbox', { name: /How was it\? contains/ });
    if (!input) await userEvent.click(screen.getByRole('button', { name: /Edit .*How was it\? contains/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /How was it\? contains/ }), 'helpful');
    if (_name === 'Responses') {
      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Actions' })).toHaveLength(1));
    } else {
      expect(screen.queryByText('Needs work')).not.toBeInTheDocument();
      expect(screen.getByText('Very HELPFUL lesson')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Subjects' })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: /Remove filter for .*How was it\?/ }));
    expect(screen.queryByRole('textbox', { name: /How was it\? contains/ })).not.toBeInTheDocument();
  },
);

it('displays a subject name in both the choice menu and selected filter', async () => {
  render(<FormResponsesPage />);
  await userEvent.click(screen.getByRole('button', { name: 'Display options' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Choose Student feedback · Q2: Subjects' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Mathematics' }));
  await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
  const pill = screen.getByRole('group', { name: 'Student feedback · Q2: Subjects filter' });
  expect(within(pill).getByRole('button', { name: /Change value/ })).toHaveTextContent('Mathematics');
  expect(screen.queryByText('subject-uuid')).not.toBeInTheDocument();
});

it('edits the operator and field directly from the condition pill', async () => {
  render(<FormResponsesPage />);
  await userEvent.click(screen.getByRole('button', { name: 'Display options' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Filter Student feedback · Q1: How was it?' }));
  if (!screen.queryByRole('textbox', { name: /How was it\? contains/ })) await userEvent.click(screen.getByRole('button', { name: /Edit .*How was it\? contains/ }));
  await userEvent.type(screen.getByRole('textbox', { name: /How was it\? contains/ }), 'helpful');
  await userEvent.click(screen.getByRole('button', { name: /Change operator for .*How was it\?/ }));
  await userEvent.click(await screen.findByRole('option', { name: 'does not contain' }));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Actions' })).toHaveLength(1));
  expect(screen.getByRole('group', { name: 'Student feedback · Q1: How was it? filter' })).toHaveTextContent('does not contain');
  await userEvent.click(screen.getByRole('button', { name: /Change field for .*How was it\?/ }));
  await userEvent.click(await screen.findByRole('option', { name: 'Student feedback · Q2: Subjects' }));
  expect(screen.getByRole('group', { name: 'Student feedback · Q2: Subjects filter' })).toHaveTextContent('Select values');
  expect(screen.queryByRole('group', { name: 'Student feedback · Q1: How was it? filter' })).not.toBeInTheDocument();
});
