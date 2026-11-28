import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForgotPasswordForm } from '../ForgotPasswordForm';
import { authApi } from '@/features/auth/api';

jest.mock('@/features/auth/api', () => ({ authApi: { requestPasswordReset: jest.fn().mockResolvedValue({}) } }));

beforeEach(() => { jest.clearAllMocks(); });

it('explains a rejected recovery link and lets the student request a new one', async () => {
  render(<ForgotPasswordForm initialError="Email link is invalid or has expired" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Email link is invalid or has expired');
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset instructions' }));
  await waitFor(() => expect(authApi.requestPasswordReset).toHaveBeenCalledWith({ email: 'student@example.test' }));
  expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('has no rejection message on an ordinary reset request', () => {
  render(<ForgotPasswordForm />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send reset instructions' })).toBeEnabled();
});

it('renders query feedback as text, without decoding it a second time', () => {
  render(<ForgotPasswordForm initialError="Invalid link: 100% <script>" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid link: 100% <script>');
  expect(document.querySelector('script')).toBeNull();
});
