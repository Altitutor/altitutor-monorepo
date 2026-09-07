/** @jest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SmartDatePickerField } from '../smart-date-picker';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SmartDatePickerField', () => {
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

  it('shows the year on the selected date by default', () => {
    act(() => {
      root.render(
        <SmartDatePickerField value="2026-09-07" onChange={() => undefined} />,
      );
    });

    expect(container.textContent).toContain('7 Sep 2026');
  });
});
