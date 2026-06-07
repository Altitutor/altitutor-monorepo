'use client';

import Link from 'next/link';
import {
  Clock,
  Ban,
  FileText,
  CreditCard,
  Calendar,
  Link2,
  Zap,
  Phone,
  Users,
  FileCheck,
  FileStack,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';
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
          title: 'Phone Numbers',
          description: 'Manage phone numbers and set the default number for sending messages',
          href: '/settings/phone-numbers',
          icon: Phone,
        },
        {
          title: 'Contacts',
          description: 'View and export all contacts as VCF for iPhone',
          href: '/settings/contacts',
          icon: Users,
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
          title: 'Pay tiers',
          description: 'Configure staff pay tier ladder and advancement requirements',
          href: '/pay-tiers/ladder',
          icon: TrendingUp,
        },
        {
          title: 'Stripe Sync',
          description: 'Sync Stripe customers to students and manage payment methods',
          href: '/settings/stripe-sync',
          icon: Link2,
        },
      ],
    },
    {
      title: 'UCAT',
      items: [
        {
          title: 'UCAT subscription',
          description: 'Pro trial, weekly and monthly pricing, practice-day discounts, and Stripe price IDs',
          href: '/settings/ucat-subscription',
          icon: GraduationCap,
        },
        {
          title: 'UCAT Free tier',
          description: 'Per-area usage limits for UCAT Free students (practice, sets, mocks, learn, skill trainer)',
          href: '/settings/ucat-free-tier',
          icon: GraduationCap,
        },
        {
          title: 'Score predictor model',
          description: 'Configure cold-start constants for UCAT section score projections',
          href: '/settings/ucat-model-config',
          icon: GraduationCap,
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          title: 'Policies',
          description: 'Configure billing policy and other policy documents',
          href: '/settings/policies',
          icon: FileCheck,
        },
        {
          title: 'Quick Filters',
          description: 'Manage global and personal quick filters',
          href: '/settings/quick-filters',
          icon: FileText,
        },
        {
          title: 'Rich Text Templates',
          description: 'Create and manage templates for issues, projects, tasks, and notes',
          href: '/settings/rich-text-templates',
          icon: FileStack,
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


