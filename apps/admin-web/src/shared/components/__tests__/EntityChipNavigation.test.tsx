/** @jest-environment jsdom */
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {RichTextEditor} from '@altitutor/ui';

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
