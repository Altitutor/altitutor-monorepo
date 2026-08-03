import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AcceptInviteForm } from '../AcceptInviteForm';
import { invitesApi } from '../../api/invites';

jest.mock('@altitutor/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const element = React.createElement;
  return {
    Alert: ({ children }: { children: React.ReactNode }) => element('div', null, children),
    AlertDescription: ({ children }: { children: React.ReactNode }) => element('div', null, children),
    Button: ({ children, className: _className, variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => element('button', props, children),
    Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (value: boolean) => void }) =>
      element('input', { type: 'checkbox', checked, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(event.target.checked) }),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => element('input', props),
    Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => element('label', props, children),
    PhoneInput: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) =>
      element('input', { value, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value) }),
    SkeletonAuthCard: () => element('div', null, 'Loading'),
    Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (value: boolean) => void }) =>
      element('input', { type: 'checkbox', checked, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(event.target.checked) }),
    validateOptionalPhoneE164: (value?: string) => value ? { phone: value } : { phone: null },
  };
}, { virtual: true });

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/shared/lib/supabase/client', () => ({
  useSupabaseClient: () => ({ auth: { signInWithPassword: jest.fn() } }),
}));

jest.mock('../../api/invites', () => ({
  invitesApi: {
    validateInvite: jest.fn(),
    acceptInvite: jest.fn(),
  },
}));

const mockedValidateInvite = jest.mocked(invitesApi.validateInvite);

describe('AcceptInviteForm', () => {
  it('presents the four-step tutor onboarding journey with payroll handoff', async () => {
    mockedValidateInvite.mockResolvedValue({
      valid: true,
      type: 'staff',
      data: {
        id: '90000000-0000-0000-0000-000000000001',
        first_name: 'Test',
        last_name: 'Tutor',
        email: 'onboarding.tutor@altitutor.test',
        phone: '+61412345678',
        role: 'TUTOR',
        subject_ids: [],
        subjects: [
          {
            id: '90000000-0000-0000-0000-000000000003',
            name: 'Mathematical Methods',
            curriculum: 'SACE',
            year_level: 12,
            level: null,
            short_name: 'Methods',
            long_name: 'Mathematical Methods',
          },
        ],
      },
    });

    render(<AcceptInviteForm token="90000000-0000-0000-0000-000000000002" />);

    expect(await screen.findByRole('heading', { name: 'Your details' })).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveValue('Test');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPassword1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'TestPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Teaching preferences' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('SACE · Year 12 · Mathematical Methods'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Employment details' })).toBeInTheDocument();
    });
    expect(screen.getByText('Payroll setup happens separately in QuickBooks')).toBeInTheDocument();
    expect(screen.getByText(/TFN, super fund and bank account details/)).toBeInTheDocument();
  });
});
