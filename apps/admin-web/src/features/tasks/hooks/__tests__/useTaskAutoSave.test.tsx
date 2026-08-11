/**
 * Feedback loop for task editor typing lag:
 * autosave must wait for debounce, not fire on every keystroke.
 */
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { useTaskAutoSave } from '../useTaskAutoSave';
import type { TaskFormData } from '../../types';

const DEBOUNCE_MS = 1000;
const TASK = { id: 'task-1' };

function AutoSaveHarness({ onSave }: { onSave: jest.Mock }) {
  const form = useForm<TaskFormData>({
    defaultValues: {
      title: 'Initial title',
      description: { type: 'doc', content: [] },
      status: 'backlog',
      priority: 0,
      assignedTo: null,
      issueId: null,
      projectId: null,
      estimate: null,
      dueDate: null,
    },
  });

  useTaskAutoSave({
    form,
    taskId: 'task-1',
    task: TASK,
    isInitialized: true,
    isUpdatingFromServer: false,
    onSave,
  });

  return <input aria-label="title" {...form.register('title')} />;
}

describe('useTaskAutoSave debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not save title on every keystroke before debounce settles', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<AutoSaveHarness onSave={onSave} />);

    // Flush baseline sync so opening the dialog does not count as a save.
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    onSave.mockClear();

    const input = screen.getByLabelText('title');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'A' } });
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Ab' } });
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Abc' } });
    });

    expect(input).toHaveValue('Abc');

    // Still inside the debounce window — must not have saved yet.
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ title: 'Abc' });
  });
});
