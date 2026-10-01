import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaffWebsiteProfile } from '../StaffWebsiteProfile';
const mockRead = jest.fn();
const mockUpsert = jest.fn();
jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockRead }) }), upsert: mockUpsert }) }) }));
beforeEach(() => { jest.clearAllMocks(); mockRead.mockResolvedValue({ data: null, error: null }); mockUpsert.mockResolvedValue({ error: null }); });
test('new staff start unpublished and admins can save publication without changing the bio', async () => {
  render(<StaffWebsiteProfile staffId="staff-1" active />);
  const checkbox = await screen.findByLabelText('Show on website');
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  fireEvent.change(screen.getByLabelText('Public title and subjects'), { target: { value: 'Maths tutor' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save website settings' }));
  await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith({ staff_id: 'staff-1', published: true, display_name: null, public_title: 'Maths tutor', display_order: 1000 }));
  expect(await screen.findByText(/Saved. Changes appear/)).toBeInTheDocument();
});
test('failed loading cannot overwrite existing publication settings', async () => {
  mockRead.mockResolvedValue({ data: null, error: new Error('unavailable') });
  render(<StaffWebsiteProfile staffId="staff-1" active={false} />);
  expect(await screen.findByText('Could not load website settings.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save website settings' })).toBeDisabled();
  expect(mockUpsert).not.toHaveBeenCalled();
});
