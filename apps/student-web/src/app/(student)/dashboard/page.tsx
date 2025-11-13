'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get student record from view
        const { data: studentData } = await supabase
          .from('vstudent_profile')
          .select('*')
          .maybeSingle();

        setStudent(studentData);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {student?.first_name || 'Student'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and view your classes
        </p>
      </div>

      {/* Future: Add more dashboard cards for sessions, attendance, etc. */}
    </div>
  );
}


