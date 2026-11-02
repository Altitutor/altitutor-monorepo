import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { EmailInput } from '../EmailInput';

it('strips mailto from a pasted address before updating the form value', () => {
  let formValue = '';
  function Form() {
    const [value, setValue] = useState('');
    return <EmailInput aria-label="Email" type="email" value={value} onChange={event => {
      formValue = event.target.value;
      setValue(formValue);
    }} />;
  }
  render(<Form />);
  fireEvent.change(screen.getByRole('textbox', {name: 'Email'}), {target: {value: 'mailto:alex@example.test'}});
  expect(formValue).toBe('alex@example.test');
  expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue('alex@example.test');
});
