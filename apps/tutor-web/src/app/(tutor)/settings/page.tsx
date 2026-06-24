'use client';

import { Ban, User } from 'lucide-react';
import { ClickableNavCard } from '@altitutor/ui';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorCardCn } from '@/shared/lib/tutor-visual';

const SETTINGS_LINKS = [
  {
    href: '/settings/profile',
    label: 'My profile',
    description: 'Details, availability, and account settings',
    icon: User,
  },
  {
    href: '/settings/blockouts',
    label: 'Blockout dates',
    description: 'Mark when you are unavailable for new bookings',
    icon: Ban,
  },
] as const;

export default function TutorSettingsPage() {
  return (
    <TutorPageContainer className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Tutor preferences and scheduling tools
        </p>
      </header>

      <section aria-labelledby="settings-nav-heading" className="space-y-4">
        <h2 id="settings-nav-heading" className="text-2xl font-semibold">
          Manage
        </h2>
        <ul className="grid items-stretch gap-4 sm:grid-cols-2">
          {SETTINGS_LINKS.map((item) => (
            <li key={item.href} className="flex min-w-0 flex-col">
              <ClickableNavCard
                href={item.href}
                icon={item.icon}
                title={item.label}
                description={item.description}
                cardClassName={tutorCardCn()}
              />
            </li>
          ))}
        </ul>
      </section>
    </TutorPageContainer>
  );
}
