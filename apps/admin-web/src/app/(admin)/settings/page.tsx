'use client';

import Link from 'next/link';
import { Clock, Ban, FileText, CreditCard, Calendar, Link2, Zap, Phone } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';

export default function SettingsPage() {
  const settingsSections = [
    {
      title: 'Scheduling',
      items: [
        // {
        //   title: 'Class Planner',
        //   description: 'Create and manage class plans',
        //   href: '/settings/class-planner',
        //   icon: LayoutGrid,
        // },
        {
          title: 'Opening Hours',
          description: 'Manage business opening hours by day of the week',
          href: '/settings/opening-hours',
          icon: Clock,
        },
        {
          title: 'Blockout Dates',
          description: 'Manage staff unavailability dates and times',
          href: '/settings/blockouts',
          icon: Ban,
        },
        {
          title: 'Booking Settings',
          description: 'Manage global booking configuration settings',
          href: '/settings/booking',
          icon: Calendar,
        },
      ],
    },
    {
      title: 'Messaging',
      items: [
        {
          title: 'Message Templates',
          description: 'Create and manage message templates',
          href: '/settings/templates',
          icon: FileText,
        },
        {
          title: 'Call Routing',
          description: 'Configure call routing rules and on-call schedules',
          href: '/settings/call-routing',
          icon: Phone,
        },
        {
          title: 'Automation Rules',
          description: 'Configure automated actions based on activity events',
          href: '/settings/automation',
          icon: Zap,
        },
      ],
    },
    {
      title: 'Financial',
      items: [
        {
          title: 'Billing Settings',
          description: 'Manage billing pricing and subject-specific overrides',
          href: '/settings/billing',
          icon: CreditCard,
        },
        {
          title: 'Stripe Sync',
          description: 'Sync Stripe customers to students and manage payment methods',
          href: '/settings/stripe-sync',
          icon: Link2,
        },
      ],
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Settings</h1>
      
      <div className="space-y-8">
        {settingsSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                        </div>
                        <CardDescription>{item.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


