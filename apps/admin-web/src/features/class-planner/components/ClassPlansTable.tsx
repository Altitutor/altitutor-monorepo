'use client';

import React from 'react';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { SkeletonTable } from '@altitutor/ui';
import { useClassPlans, useDeleteClassPlan, useDuplicateClassPlan } from '../hooks/useClassPlansQuery';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useCurrentStaff } from '@/shared/hooks';
import { useToast } from '@altitutor/ui';
import type { DraftClassPlan } from '../api/classPlans';
import { SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

interface ClassPlansTableProps {
  onCreatePlan: () => void;
}

export function ClassPlansTable({ onCreatePlan }: ClassPlansTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const { data: plans, isLoading, error, refetch } = useClassPlans();
  const deleteMutation = useDeleteClassPlan();
  const duplicateMutation = useDuplicateClassPlan();

  const handleEdit = (planId: string) => {
    router.push(`/settings/class-planner/${planId}`);
  };

  const handleDuplicate = async (plan: DraftClassPlan) => {
    if (!currentStaff?.id) {
      toast({
        title: 'Error',
        description: 'Unable to identify current staff member',
        variant: 'destructive',
      });
      return;
    }

    try {
      await duplicateMutation.mutateAsync({
        id: plan.id,
        newName: `${plan.name} (Copy)`,
        createdBy: currentStaff.id,
      });
      toast({
        title: 'Success',
        description: 'Plan duplicated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate plan',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (plan: DraftClassPlan) => {
    if (!confirm(`Are you sure you want to delete "${plan.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(plan.id);
      toast({
        title: 'Success',
        description: 'Plan deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete plan',
        variant: 'destructive',
      });
    }
  };

  const handleApply = (planId: string) => {
    router.push(`/settings/class-planner/${planId}?apply=true`);
  };

  const getStatusBadge = (status: string | null) => {
    const statusValue = status || 'DRAFT';
    switch (statusValue) {
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>;
      case 'APPLIED':
        return <Badge className="bg-green-100 text-green-800">Applied</Badge>;
      case 'ARCHIVED':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">{statusValue}</Badge>;
    }
  };

  const columns: SettingsDataTableColumn<DraftClassPlan>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (plan) => <span className="font-medium">{plan.name}</span>,
      sortValue: (plan) => plan.name,
      searchValue: (plan) => plan.name,
    },
    {
      key: 'year',
      label: 'Year',
      render: (plan) => plan.year,
      sortValue: (plan) => plan.year,
      searchValue: (plan) => String(plan.year),
    },
    {
      key: 'status',
      label: 'Status',
      render: (plan) => getStatusBadge(plan.status),
      sortValue: (plan) => plan.status || 'DRAFT',
      filterValue: (plan) => plan.status || 'DRAFT',
      searchValue: (plan) => plan.status || 'DRAFT',
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (plan) => plan.created_at ? format(new Date(plan.created_at), 'MMM d, yyyy') : '-',
      sortValue: (plan) => plan.created_at ?? '',
      searchValue: (plan) => plan.created_at ? format(new Date(plan.created_at), 'MMM d, yyyy') : '',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonTable rows={8} columns={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Failed to load class plans. Please try again.
        <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!plans || plans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">No class plans yet</p>
          <p className="text-sm mb-4">Create your first class plan to get started</p>
          <Button onClick={onCreatePlan}>Create Class Plan</Button>
        </div>
      ) : (
        <SettingsDataTable
          data={plans}
          columns={columns}
          getRowId={(plan) => plan.id}
          emptyMessage="No class plans yet"
          searchPlaceholder="Search class plans..."
          filterKeys={['status']}
          filterDefinitions={[
            {
              key: 'status',
              label: 'Status',
              options: ['DRAFT', 'APPLIED', 'ARCHIVED'].map((value) => ({ label: value, value })),
            },
          ]}
          defaultSort={{ field: 'name', direction: 'asc' }}
          getActions={(plan) => [
            {
              id: 'edit',
              label: 'Edit',
              onSelect: () => handleEdit(plan.id),
            },
            {
              id: 'duplicate',
              label: 'Duplicate',
              onSelect: () => handleDuplicate(plan),
            },
            ...(plan.status === 'DRAFT'
              ? [{
                  id: 'apply',
                  label: 'Apply Plan',
                  onSelect: () => handleApply(plan.id),
                }]
              : []),
            {
              id: 'delete',
              label: 'Delete',
              disabled: deleteMutation.isPending,
              onSelect: () => handleDelete(plan),
            },
          ]}
        />
      )}
    </div>
  );
}
