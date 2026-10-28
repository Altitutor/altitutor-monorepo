"use client";

import { settingsSections } from '@/shared/constants/adminSettings';
import { AdminSettingsCard } from "@/shared/components";

export default function SettingsPage() {

  return (
      <div className="p-6">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Settings</h1>

        <div className="space-y-8">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <AdminSettingsCard
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
}
