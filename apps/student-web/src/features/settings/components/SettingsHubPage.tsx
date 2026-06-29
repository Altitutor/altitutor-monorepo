'use client';

import { Palette, User } from 'lucide-react';
import { ClickableNavCard } from '@altitutor/ui';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentCardCn } from '@/shared/lib/student-visual';
import { SettingsPageHeader } from './SettingsPageHeader';

const SETTINGS_LINKS = [
  {
    href: '/settings/app',
    label: 'App settings',
    description: 'Onboarding and portal preferences.',
    icon: Palette,
  },
  {
    href: '/settings/profile',
    label: 'My profile',
    description: 'Personal details, availability, and account settings.',
    icon: User,
  },
] as const;

export function SettingsHubPage() {
  return (
    <StudentPageContainer className="space-y-8">
      <SettingsPageHeader
        title="Settings"
        description="Choose what you want to manage."
      />

      <section aria-labelledby="settings-nav-heading">
        <h2 id="settings-nav-heading" className="sr-only">
          Settings sections
        </h2>
        <ul className="grid items-stretch gap-4 sm:grid-cols-2">
          {SETTINGS_LINKS.map((item) => (
            <li key={item.href} className="flex min-w-0 flex-col">
              <ClickableNavCard
                href={item.href}
                icon={item.icon}
                title={item.label}
                description={item.description}
                cardClassName={studentCardCn()}
              />
            </li>
          ))}
        </ul>
      </section>
    </StudentPageContainer>
  );
}
