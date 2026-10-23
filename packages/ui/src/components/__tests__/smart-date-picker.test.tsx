/** @jest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SmartDatePickerField } from '../smart-date-picker';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SmartDatePickerField', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

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

  it('opens on the selected month, focuses typing, and selects a past calendar date', async () => {
    const onChange = jest.fn();
    await act(async () => {
      root.render(<SmartDatePickerField value="2026-09-07" onChange={onChange} />);
    });
    await act(async () => container.querySelector('button')?.click());

    expect(document.activeElement?.getAttribute('placeholder')).toBe('Type a date...');
    expect(document.body.textContent).toContain('September 2026');
    const selected = document.querySelector('button[aria-label="Monday, 7 September 2026"]');
    expect(selected?.getAttribute('aria-pressed')).toBe('true');
    const previous = document.querySelector<HTMLButtonElement>('button[aria-label="Previous month"]');
    await act(async () => previous?.click());
    expect(document.body.textContent).toContain('August 2026');
    const day = document.querySelector<HTMLButtonElement>('button[aria-label="Wednesday, 12 August 2026"]');
    expect(day).not.toBeNull();
    await act(async () => day?.click());
    expect(onChange).toHaveBeenCalledWith('2026-08-12');
  });

  it('marks today and the selected date independently and clears the value', async () => {
    const today = new Date();
    const selected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const onChange = jest.fn();
    const onBlur = jest.fn();
    await act(async () => root.render(<SmartDatePickerField value={selected} onChange={onChange} onBlur={onBlur} />));
    await act(async () => container.querySelector('button')?.click());
    expect(document.querySelector('[aria-current="date"]')?.textContent).toBe(String(today.getDate()));
    expect(document.querySelector('[aria-pressed="true"]')?.textContent).toBe('1');
    const clear = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Clear date');
    expect(clear?.className).toContain('text-destructive');
    await act(async () => clear?.click());
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('applies bounds to calendar and typed dates and preserves ISO output', async () => {
    const onChange = jest.fn();
    await act(async () => root.render(<SmartDatePickerField value="2026-09-07" minDate="2026-09-05" maxDate="2026-09-10" valueFormat="iso" onChange={onChange} />));
    await act(async () => container.querySelector('button')?.click());
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Friday, 4 September 2026"]')?.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Friday, 11 September 2026"]')?.disabled).toBe(true);
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Type a date"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const type = async (value: string) => {
      await act(async () => {
        setValue?.call(input, value);
        input?.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    };
    await type('4 September 2026');
    expect(onChange).not.toHaveBeenCalled();
    await type('8 September 2026');
    expect(onChange).toHaveBeenCalledWith('2026-09-08T00:00:00.000Z');
  });

  it('resets the displayed month on reopening and supports caller shortcuts', async () => {
    const onChange = jest.fn();
    await act(async () => root.render(<SmartDatePickerField value="2026-09-07" presets={[{ label: 'Report cutoff', value: new Date(2026, 8, 1) }]} onChange={onChange} />));
    await act(async () => container.querySelector('button')?.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Next month"]')?.click());
    expect(document.body.textContent).toContain('October 2026');
    await act(async () => container.querySelector('button')?.click());
    await act(async () => container.querySelector('button')?.click());
    expect(document.body.textContent).toContain('September 2026');
    const preset = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Report cutoff'));
    await act(async () => preset?.click());
    expect(onChange).toHaveBeenCalledWith('2026-09-01');
  });
});
