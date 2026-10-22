import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormResponsesPage } from '../FormResponsesPage';
import { FormReportsPage } from '../FormReportsPage';
import { responses } from './answer-filter-fixtures';

const originalFetch = global.fetch;
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = jest.fn();
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
    const add = await screen.findByRole('combobox', { name: 'Add answer filter' });
    await waitFor(() => expect(add).not.toBeDisabled());
    await userEvent.click(add);
    await userEvent.click(await screen.findByRole('option', { name: 'Student feedback · Q1: How was it?' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'How was it? contains' }), 'helpful');
    if (_name === 'Responses') {
      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Actions' })).toHaveLength(1));
    } else {
      expect(screen.queryByText('Needs work')).not.toBeInTheDocument();
      expect(screen.getByText('Very HELPFUL lesson')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Subjects' })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter for How was it?' }));
    expect(screen.queryByRole('textbox', { name: 'How was it? contains' })).not.toBeInTheDocument();
  },
);

it('displays a subject name in both the choice menu and selected filter', async () => {
  render(<FormResponsesPage />);
  const add = await screen.findByRole('combobox', { name: 'Add answer filter' });
  await waitFor(() => expect(add).not.toBeDisabled());
  await userEvent.click(add);
  await userEvent.click(await screen.findByRole('option', { name: 'Student feedback · Q2: Subjects' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Subjects includes any' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Mathematics' }));
  expect(screen.getByRole('button', { name: 'Remove Mathematics' })).toBeInTheDocument();
  expect(screen.queryByText('subject-uuid')).not.toBeInTheDocument();
});
