import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaymentMethodsList } from '../PaymentMethodsList';
import type { PaymentMethodData } from '../../api/payment-methods';

// The repository SWC test transform uses the classic JSX runtime.
Object.assign(globalThis, { React });

const mockSetDefault = jest.fn();
const mockDelete = jest.fn();
jest.mock('../../hooks/usePaymentMethods', () => ({
  useSetDefaultPaymentMethod: () => ({ mutate: mockSetDefault, isPending: false }),
  useDeletePaymentMethod: () => ({ mutate: mockDelete, isPending: false }),
}));
jest.mock('@altitutor/ui', () => ({
  ...jest.requireActual('@altitutor/ui/components/payment-method-card'),
  ...jest.requireActual('@altitutor/ui/components/alert-dialog'),
}));

it('offers card actions only after the optimistic card receives its persisted ID', () => {
  const card: PaymentMethodData = {
    id: 'temp-pm_fixture', stripe_payment_method_id: 'pm_fixture',
    card_brand: 'visa', card_last4: '4242', card_exp_month: 12,
    card_exp_year: 2030, is_default: false, card_country: null,
    created_at: '2026-09-10T00:00:00Z',
  };
  const { rerender } = render(<PaymentMethodsList paymentMethods={[card]} />);
  expect(screen.getByText(/4242/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /set.*default/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  expect(mockSetDefault).not.toHaveBeenCalled();
  expect(mockDelete).not.toHaveBeenCalled();

  const persistedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  rerender(<PaymentMethodsList paymentMethods={[{ ...card, id: persistedId }]} />);
  fireEvent.click(screen.getByRole('button', { name: /set.*default/i }));
  expect(mockSetDefault).toHaveBeenCalledWith(persistedId);
  fireEvent.click(screen.getByRole('button', { name: /remove/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(mockDelete).toHaveBeenCalledWith(persistedId);
});
