import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsNavMenu } from './SettingsNavMenu';

let pathname = '/settings/opening-hours';
jest.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/settings/opening-hours';
});

describe('SettingsNavMenu', () => {
  it('puts Back to app at the top and links it to the dashboard', () => {
    render(<SettingsNavMenu />);
    const back = screen.getByRole('link', { name: 'Back to app' });
    expect(back).toHaveAttribute('href', '/dashboard');
    const links = screen.getAllByRole('link');
    expect(links[0]).toBe(back);
  });

  it('lists settings pages under their headings and marks the current page', () => {
    render(<SettingsNavMenu />);
    expect(screen.getByRole('button', { name: 'Scheduling' })).toBeInTheDocument();
    const openingHours = screen.getByRole('link', { name: 'Opening Hours' });
    expect(openingHours).toHaveAttribute('href', '/settings/opening-hours');
    expect(openingHours).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Pay tiers' })).toHaveAttribute('href', '/pay-tiers/ladder');
    expect(screen.getByRole('link', { name: 'Blockout Dates' })).not.toHaveAttribute('aria-current');
  });

  it('filters the list from the search field and hides empty headings', async () => {
    const user = userEvent.setup();
    render(<SettingsNavMenu />);
    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'printer');
    expect(screen.getByRole('link', { name: 'Office print' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Opening Hours' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scheduling' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to app' })).toBeInTheDocument();
  });

  it('shows every settings page again when the sidebar collapses during a search', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SettingsNavMenu />);
    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'printer');
    expect(screen.queryByRole('link', { name: 'Opening Hours' })).not.toBeInTheDocument();
    rerender(<SettingsNavMenu collapsed />);
    expect(screen.getByRole('link', { name: 'Opening Hours' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Office print' })).toBeInTheDocument();
    rerender(<SettingsNavMenu />);
    expect(screen.getByRole('searchbox', { name: 'Search settings' })).toHaveValue('');
  });

  it('hides the search field when the sidebar is collapsed', () => {
    render(<SettingsNavMenu collapsed />);
    expect(screen.queryByRole('searchbox', { name: 'Search settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to app' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Opening Hours' })).toBeInTheDocument();
  });
});
