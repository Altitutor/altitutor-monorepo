'use client';

import Link from 'next/link';
import { UcatSkillTrainerConfigForm } from '@/features/ucat-skill-trainer-config/components/UcatSkillTrainerConfigForm';

export default function UcatSkillTrainersSettingsPage() {
  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
          ← Settings
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2">UCAT skill trainers</h1>
      </div>
      <UcatSkillTrainerConfigForm />
    </div>
  );
}
