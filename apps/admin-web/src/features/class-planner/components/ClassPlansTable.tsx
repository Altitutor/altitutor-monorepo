'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { SkeletonTable } from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { MoreVertical, Plus, Edit, Copy, Trash2, Play } from 'lucide-react';
import { useClassPlans, useDeleteClassPlan, useDuplicateClassPlan } from '../hooks/useClassPlansQuery';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useCurrentStaff } from '@/shared/hooks';
import { useToast } from '@altitutor/ui';
import type { DraftClassPlan } from '../api/classPlans';

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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Class Plans</h2>
        <Button onClick={onCreatePlan}>
          <Plus className="h-4 w-4 mr-2" />
          Create Class Plan
        </Button>
      </div>

      {!plans || plans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">No class plans yet</p>
          <p className="text-sm mb-4">Create your first class plan to get started</p>
          <Button onClick={onCreatePlan}>
            <Plus className="h-4 w-4 mr-2" />
            Create Class Plan
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{plan.year}</TableCell>
                  <TableCell>{getStatusBadge(plan.status)}</TableCell>
                  <TableCell>
                    {plan.created_at
                      ? format(new Date(plan.created_at), 'MMM d, yyyy')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(plan.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(plan)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {plan.status === 'DRAFT' && (
                          <DropdownMenuItem onClick={() => handleApply(plan.id)}>
                            <Play className="h-4 w-4 mr-2" />
                            Apply Plan
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDelete(plan)}
                          className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
