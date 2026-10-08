import { fireEvent, render, screen } from '@testing-library/react';
import { Navbar } from '../Navbar';

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
jest.mock('@/shared/shortcuts/ShortcutKeys', () => ({ ShortcutKeys: () => null }));
jest.mock('../DashboardDatePicker', () => ({ DashboardDatePicker: () => null }));
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
