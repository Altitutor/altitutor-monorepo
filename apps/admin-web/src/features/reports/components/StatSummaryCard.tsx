'use client';

import { Card, CardContent } from '@altitutor/ui';
import type { LucideIcon } from 'lucide-react';

interface StatSummaryCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  loading?: boolean;
  description?: string;
}

export function StatSummaryCard({
  label,
  value,
  icon: Icon,
  loading,
  description,
}: StatSummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center space-x-4 py-4">
        {Icon && (
          <div className="p-2 bg-muted rounded-lg">
            <Icon className="h-6 w-6 text-brand-darkBlue dark:text-brand-lightBlue" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">
            {loading ? '...' : value}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

