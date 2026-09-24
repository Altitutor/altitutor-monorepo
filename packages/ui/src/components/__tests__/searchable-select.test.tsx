/** @jest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  SearchableSelect,
  clearOptionMatchesSearch,
} from '../searchable-select';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('clearOptionMatchesSearch', () => {
  it('shows the clear option when search is empty', () => {
    expect(clearOptionMatchesSearch('None', '')).toBe(true);
    expect(clearOptionMatchesSearch('None', '   ')).toBe(true);
  });

  it('shows the clear option when the query matches the label', () => {
    expect(clearOptionMatchesSearch('None', 'non')).toBe(true);
    expect(clearOptionMatchesSearch('None', 'NONE')).toBe(true);
  });

  it('hides the clear option when the query does not match', () => {
    expect(clearOptionMatchesSearch('None', 'matt')).toBe(false);
    expect(clearOptionMatchesSearch('None', 'alice')).toBe(false);
  });
});

describe('SearchableSelect', () => {
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

  it('marks the trigger wrapper so property forms can stretch it', () => {
    act(() => {
      root.render(
        <SearchableSelect
          items={[{ id: 'a', label: 'Alpha' }]}
          value={null}
          onValueChange={() => undefined}
          getItemId={(item) => item.id}
          getItemLabel={(item) => item.label}
        />,
      );
    });

    expect(container.querySelector('[data-searchable-select-trigger]')).not.toBeNull();
  });
});
