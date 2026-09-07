/** @jest-environment jsdom */

import React, { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Popover, PopoverTrigger } from '../popover';
import { SearchableSelectFieldTrigger } from '../searchable-select-field-trigger';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SearchableSelectFieldTrigger', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('forwards a ref to the native button so Radix PopoverTrigger asChild can attach', () => {
    const ref = createRef<HTMLButtonElement>();

    act(() => {
      root.render(
        <Popover>
          <PopoverTrigger asChild>
            <SearchableSelectFieldTrigger ref={ref}>Folder</SearchableSelectFieldTrigger>
          </PopoverTrigger>
        </Popover>,
      );
    });

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toContain('Folder');
  });
});
