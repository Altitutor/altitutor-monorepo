import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteFormResponseConfirmDialog } from '../DeleteFormResponseConfirmDialog';
import type { FormResponseDetail } from '../FormResponseDialog';

const response: FormResponseDetail = {
  id: 'response-id',
  respondent_type: 'staff',
  subject_type: 'staff',
  submitted_at: '2026-07-19T03:58:04.434Z',
};

describe('DeleteFormResponseConfirmDialog', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('deletes the response after confirmation', async () => {
    const onDeleted = jest.fn();
    const onOpenChange = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseId: response.id }),
    } as Response);

    render(
      <DeleteFormResponseConfirmDialog
        response={response}
        open
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete response' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(response.id));
    expect(global.fetch).toHaveBeenCalledWith('/api/forms/responses', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ responseId: response.id }),
    }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
