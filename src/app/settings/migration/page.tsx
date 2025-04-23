import React from 'react';
import { Metadata } from 'next';
import MigrationTool from '@/components/migration/MigrationTool';

export const metadata: Metadata = {
  title: 'Database Migration | AltiTutor Admin',
  description: 'Migrate your local database to Supabase cloud database',
};

export default function MigrationPage() {
  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Database Migration</h1>
        <p className="text-muted-foreground mt-2">
          Migrate your local database to Supabase cloud storage
        </p>
      </div>
      
      <div className="mt-6">
        <MigrationTool />
      </div>
    </div>
  );
} 