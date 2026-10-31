import {
  filterSettingsSections,
  firstSettingsHref,
  isSettingsRoute,
  settingsBackHref,
  settingsSections,
} from './settings-nav';

const visibleTitles = (query: string) =>
  filterSettingsSections(settingsSections, query).flatMap((section) =>
    section.items.map((item) => item.title),
  );

describe('settings navigation', () => {
  it('keeps every current settings destination under its heading', () => {
    expect(
      settingsSections.map((section) => ({
        title: section.title,
        items: section.items.map((item) => ({ title: item.title, href: item.href })),
      })),
    ).toEqual([
      {
        title: 'AI applications',
        items: [{ title: 'AI connections', href: '/settings/ai-connections' }],
      },
      {
        title: 'Student records',
        items: [{ title: 'Duplicate students', href: '/settings/duplicate-students' }],
      },
      {
        title: 'Scheduling',
        items: [
          { title: 'Opening Hours', href: '/settings/opening-hours' },
          { title: 'Blockout Dates', href: '/settings/blockouts' },
          { title: 'Booking Settings', href: '/settings/booking' },
        ],
      },
      {
        title: 'Messaging',
        items: [
          { title: 'Messaging', href: '/settings/messaging' },
          { title: 'Message Templates', href: '/settings/templates' },
          { title: 'Call Routing', href: '/settings/call-routing' },
          { title: 'Phone Numbers', href: '/settings/phone-numbers' },
          { title: 'Contacts', href: '/settings/contacts' },
          { title: 'Automation Rules', href: '/settings/automation' },
        ],
      },
      {
        title: 'Financial',
        items: [
          { title: 'Billing Settings', href: '/settings/billing' },
          { title: 'Pay tiers', href: '/pay-tiers/ladder' },
          { title: 'Stripe Sync', href: '/settings/stripe-sync' },
        ],
      },
      {
        title: 'UCAT',
        items: [
          { title: 'UCAT email campaigns', href: '/settings/ucat-campaigns' },
          { title: 'UCAT billing', href: '/settings/ucat-billing' },
          { title: 'UCAT skill trainers', href: '/settings/ucat-skill-trainers' },
          { title: 'UCAT generation', href: '/settings/ucat-generation' },
          { title: 'Score projection', href: '/settings/score-projection' },
          { title: 'UCAT insight feedback', href: '/settings/ucat-content-feedback' },
        ],
      },
      {
        title: 'Learning',
        items: [{ title: 'Flashcard presets', href: '/settings/flashcards' }],
      },
      {
        title: 'System',
        items: [
          { title: 'Deleted entities', href: '/settings/deleted-records' },
          { title: 'Policies', href: '/settings/policies' },
          { title: 'Views', href: '/settings/quick-filters' },
          { title: 'Rich Text Templates', href: '/settings/rich-text-templates' },
          { title: 'Forms', href: '/settings/forms' },
          { title: 'Office print', href: '/settings/office-print' },
        ],
      },
    ]);
  });

  it('opens the first settings page from the settings index', () => {
    expect(firstSettingsHref).toBe('/settings/ai-connections');
  });

  it('sends Back to app to the dashboard', () => {
    expect(settingsBackHref).toBe('/dashboard');
  });

  it('filters page titles and descriptions and hides empty headings', () => {
    expect(
      filterSettingsSections(settingsSections, 'billing').map((section) => section.title),
    ).toEqual(['Financial', 'UCAT', 'System']);
    expect(visibleTitles('billing')).toEqual(['Billing Settings', 'UCAT billing', 'Policies']);
    expect(visibleTitles('printer')).toEqual(['Office print']);
    expect(visibleTitles('OPENING')).toEqual(['Opening Hours']);
    expect(filterSettingsSections(settingsSections, '   ')).toBe(settingsSections);
    expect(filterSettingsSections(settingsSections, 'zzzz-no-match')).toEqual([]);
  });

  it('treats only /settings routes as the settings shell', () => {
    expect(isSettingsRoute('/settings')).toBe(true);
    expect(isSettingsRoute('/settings/billing')).toBe(true);
    expect(isSettingsRoute('/settings-extra')).toBe(false);
    expect(isSettingsRoute('/pay-tiers/ladder')).toBe(false);
    expect(isSettingsRoute('/dashboard')).toBe(false);
  });
});
