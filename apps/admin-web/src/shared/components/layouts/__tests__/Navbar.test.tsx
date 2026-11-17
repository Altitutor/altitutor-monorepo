import { fireEvent, render, screen, within } from '@testing-library/react';
import { Navbar } from '../Navbar';
import userEvent from '@testing-library/user-event';

const toggle = jest.fn();
jest.mock('@/shared/contexts/MobileMenuContext', () => ({ useMobileMenu: () => ({ toggle, isOpen: false }) }));
jest.mock('@/shared/contexts/AdminShellContext', () => ({ useAdminShell: () => ({ sidebarCollapsed: false, toggleSidebar: jest.fn() }) }));
jest.mock('@/shared/contexts/AccessoryPanelContext', () => ({ useAccessoryPanel: () => null }));
jest.mock('@/shared/contexts/CommandPaletteContext', () => ({ useCommandPalette: () => ({ toggle: jest.fn() }) }));
jest.mock('@/shared/lib/supabase/auth', () => ({ useAuthStore: () => ({ user: { id: 'staff' } }) }));
jest.mock('@/features/messages/api/queries', () => ({ useUnreadConversationCount: () => ({ data: 0 }) }));
jest.mock('@/features/messages/hooks/useMessageSubscription', () => ({ useMessageSubscription: jest.fn() }));
jest.mock('@/shared/hooks', () => ({ useCurrentStaff: () => ({ data: null }) }));
jest.mock('@/features/notifications', () => ({ NotificationsTray: () => null, useNotificationsRealtime: jest.fn() }));
jest.mock('@/shared/shortcuts/ShortcutKeys', () => ({ ShortcutKeys: ({ id }: { id: string }) => <span>{id === 'left' ? '[' : id === 'right' ? ']' : 'palette'}</span> }));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));
jest.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));

test('the left sidebar button is visible at the mobile breakpoint and opens the menu', () => {
  render(<Navbar />);
  const button = screen.getByRole('button', { name: 'Open menu' });
  // jsdom does not evaluate Tailwind media queries; verify the responsive visibility contract.
  expect(button).not.toHaveClass('hidden');
  expect(button).toHaveClass('md:hidden');
  fireEvent.click(button);
  expect(toggle).toHaveBeenCalledTimes(1);
});


it('shows the sidebar action and key only inside its hover tooltip', async () => {
  const user = userEvent.setup();
  render(<Navbar />);
  expect(screen.queryByText('[')).toBeNull();
  await user.hover(screen.getByRole('button', { name: 'Collapse sidebar' }));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('Collapse sidebar');
  expect(within(tooltip).getByText('[')).toBeInTheDocument();
});
