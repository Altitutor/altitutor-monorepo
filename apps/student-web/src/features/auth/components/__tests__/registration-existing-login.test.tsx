import { render, screen } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import type { RegistrationFormValues } from '../../validations';
import { RegistrationStep4Password } from '../RegistrationStep4Password';

it('keeps existing sign-in methods without asking for a password during registration', () => {
  render(<RegistrationStep4Password form={{} as UseFormReturn<RegistrationFormValues>} skipPassword />);
  expect(screen.getByRole('heading', { name: 'Keep your existing login' })).toBeInTheDocument();
  expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Forgot password after registration/)).toBeInTheDocument();
});
