import { act, fireEvent, render, screen } from '@testing-library/react';
import { FormAnswerer } from '@altitutor/ui';

describe('FormAnswerer submission', () => {
  it('ignores repeated submits while the first submission is pending', async () => {
    let resolveSubmission: (() => void) | undefined;
    const onSubmit = jest.fn(() => new Promise<void>((resolve) => {
      resolveSubmission = resolve;
    }));
    const onSubmittingChange = jest.fn();

    render(
      <FormAnswerer
        title="Staff Check-In"
        blocks={[]}
        onSubmit={onSubmit}
        onSubmittingChange={onSubmittingChange}
      />,
    );

    const form = screen.getByRole('button', { name: 'Submit' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmittingChange).toHaveBeenCalledWith(true);

    await act(async () => resolveSubmission?.());

    expect(onSubmittingChange).toHaveBeenLastCalledWith(false);
  });
});
