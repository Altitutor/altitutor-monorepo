import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileMenuProvider, useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { MobileSidebar } from '../MobileSidebar';

let pathname = '/students';
jest.mock('next/navigation', () => ({ usePathname: () => pathname }));

function Controls() {
  const menu = useMobileMenu();
  return <>
    <button aria-controls="admin-mobile-sidebar" onClick={menu.open}>Open menu</button>
    <MobileSidebar isOpen={menu.isOpen} onClose={menu.close}>
      <a href="#students">Students</a>
    </MobileSidebar>
  </>;
}

beforeEach(() => { pathname = '/students'; });

test('opens from the left, closes with its close button, and restores focus', async () => {
  const user = userEvent.setup();
  render(<MobileMenuProvider><Controls /></MobileMenuProvider>);
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  expect(screen.getByRole('dialog', { name: 'Altitutor Admin' })).toHaveClass('left-0', 'data-[state=open]:slide-in-from-left');
  await user.click(screen.getByRole('button', { name: 'Close menu' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
});

test('Escape dismisses the drawer', async () => {
  const user = userEvent.setup();
  render(<MobileMenuProvider><Controls /></MobileMenuProvider>);
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('backdrop interaction dismisses the drawer', async () => {
  const user = userEvent.setup();
  render(<MobileMenuProvider><Controls /></MobileMenuProvider>);
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  const overlay = document.querySelector('[data-mobile-menu-overlay]')!;
  await user.click(overlay);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('primary route changes dismiss the drawer', async () => {
  const user = userEvent.setup();
  const view = render(<MobileMenuProvider><Controls /></MobileMenuProvider>);
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  pathname = '/invoices';
  view.rerender(<MobileMenuProvider><Controls /></MobileMenuProvider>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('selecting the current navigation link dismisses the drawer', async () => {
  const user = userEvent.setup();
  render(<MobileMenuProvider><Controls /></MobileMenuProvider>);
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  fireEvent.click(screen.getByRole('link', { name: 'Students' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
