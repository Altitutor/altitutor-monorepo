/** @jest-environment jsdom */
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {RichTextEditor} from '@altitutor/ui';
import { EditorView } from '@tiptap/pm/view';
import { fireEvent, render, screen } from '@testing-library/react';
import { EntityActionChip } from '../EntityActionChip';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
it('activates a rich-text entity chip without putting the caret inside the reference', async () => {
  const container = document.createElement('div');document.body.appendChild(container);
  const root = createRoot(container);
  const received: unknown[] = [];
  const listener = (event: Event) => received.push((event as CustomEvent).detail);
  window.addEventListener('mentionClick', listener);
  try {
    await act(async () => root.render(<RichTextEditor content={{type:'doc',content:[{type:'paragraph',content:[{type:'mention',attrs:{id:'student-id',type:'student',label:'Alex Student'}}]}]}} onChange={() => undefined} mentionSuggestions={{items: () => []}} />));
    const mention = container.querySelector<HTMLElement>('[data-mention]')!;
    expect(mention).not.toBeNull();
    act(() => mention.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, button: 0})));
    expect(received).toEqual([{id:'student-id',type:'student',label:'Alex Student'}]);
  } finally {
    act(() => root.unmount());container.remove();window.removeEventListener('mentionClick',listener);
  }
});

it('copies a student chip from another pane as an editable entity mention', async () => {
  const changes = jest.fn();
  render(
    <>
      <section aria-label="Directory pane">
        <EntityActionChip entityType="student" entityId="student-id" label="Alex [Student]" />
      </section>
      <section aria-label="Notes pane">
        <RichTextEditor content="" onChange={changes} mentionSuggestions={{ items: () => [] }} />
      </section>
    </>,
  );

  const chip = screen.getByRole('button', { name: 'Alex [Student]' });
  expect(chip).toHaveAttribute('draggable', 'true');
  const editor = screen.getByRole('region', { name: 'Notes pane' }).querySelector<HTMLElement>('.tiptap')!;
  expect(editor).toBeInTheDocument();

  const data = new Map<string, string>();
  const dataTransfer = {
    effectAllowed: 'uninitialized',
    dropEffect: 'none',
    get types() { return [...data.keys()]; },
    files: [],
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
  };
  fireEvent.dragStart(chip, { dataTransfer });
  expect(dataTransfer.effectAllowed).toBe('copy');
  const positionAtDrop = jest.spyOn(EditorView.prototype, 'posAtCoords').mockReturnValue(null);
  try {
    expect(fireEvent.dragOver(editor, { dataTransfer })).toBe(false);
    expect(dataTransfer.dropEffect).toBe('copy');

    positionAtDrop.mockReturnValue({ pos: 1, inside: 0 });
    fireEvent.drop(editor, { dataTransfer });
  } finally {
    positionAtDrop.mockRestore();
  }
  expect(changes).toHaveBeenLastCalledWith({
    type: 'doc',
    content: [{ type: 'paragraph', content: [
      { type: 'mention', attrs: expect.objectContaining({ id: 'student-id', type: 'student', label: 'Alex [Student]' }) },
      { type: 'text', text: ' ' },
    ] }],
  });
  expect(editor.querySelector('[data-type="student"][data-id="student-id"]')).toHaveTextContent('Alex [Student]');
  expect(chip).toBeInTheDocument();
});
