/** @jest-environment jsdom */
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/dom';
import { PhoneInput } from '../phone-input';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function ControlledPhone() {
  const [value, setValue] = useState('+61410000001');
  return <PhoneInput id="phone" value={value} onChange={setValue} />;
}

it('preserves an in-progress calling-code edit until the number field loses focus', () => {
  act(() => root.render(<ControlledPhone />));
  const input = container.querySelector<HTMLInputElement>('input[type="tel"]')!;
  act(() => { input.focus(); });
  act(() => {
    fireEvent.change(input, { target: { value: '+4 410 000 001' } });
  });
  expect(input.value).toBe('+4 410 000 001');
});

it('normalizes an Australian national mobile on blur while keeping form state current', () => {
  let submitted = '';
  function Form() {
    const [value, setValue] = useState('');
    return <form onSubmit={event => { event.preventDefault(); submitted = value; }}>
      <PhoneInput value={value} onChange={setValue} />
    </form>;
  }
  act(() => root.render(<Form />));
  const input = container.querySelector<HTMLInputElement>('input[type="tel"]')!;
  act(() => { input.focus(); });
  act(() => { fireEvent.change(input, { target: { value: '0412 345 678' } }); });
  expect(input.value).toBe('0412 345 678');
  act(() => fireEvent.submit(container.querySelector('form')!));
  expect(submitted).toBe('+61412345678');
  act(() => input.blur());
  expect(input.value).toBe('+61 412 345 678');
});
