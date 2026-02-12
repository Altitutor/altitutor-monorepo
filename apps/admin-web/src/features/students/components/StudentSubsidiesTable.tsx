'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
} from '@altitutor/ui';
import { Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { getErrorMessage } from '@/shared/utils';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/shared/utils';
import { formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils';
import type { StudentSubsidyRow } from '../api/subsidies';
import { deleteSubsidy } from '../api/subsidies';
import { studentSubsidiesKeys } from './StudentBillingTab';
import { EditSubsidyModal } from './EditSubsidyModal';
import { useBillingPricing } from '@/features/billing/hooks/useBillingPricing';

interface StudentSubsidiesTableProps {
  subsidies: StudentSubsidyRow[];
  studentId: string;
}

export function StudentSubsidiesTable({ subsidies, studentId }: StudentSubsidiesTableProps) {
  const [editingSubsidy, setEditingSubsidy] = useState<StudentSubsidyRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data: defaultPricing = [] } = useBillingPricing();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper to get default hourly rate for a billing type
  const getDefaultHourlyRate = (billingType: string): number | null => {
    const pricing = defaultPricing.find((p) => p.billing_type === billingType);
    return pricing ? pricing.hourly_rate_cents : null;
  };

  const handleDelete = async (subsidyId: string) => {
    if (!confirm('Are you sure you want to delete this subsidy?')) return;

    setDeletingId(subsidyId);
    try {
      await deleteSubsidy(subsidyId);
      toast({
        title: 'Success',
        description: 'Subsidy deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: studentSubsidiesKeys.student(studentId) });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to delete subsidy',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSuccess = () => {
    setEditingSubsidy(null);
    queryClient.invalidateQueries({ queryKey: studentSubsidiesKeys.student(studentId) });
  };

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Billing Type</TableHead>
              <TableHead>Subsidy Price Per Hour</TableHead>
              <TableHead>Default Price Per Hour</TableHead>
              <TableHead>Effective From</TableHead>
              <TableHead>Effective Until</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subsidies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No subsidies configured for this student
                </TableCell>
              </TableRow>
            ) : (
              subsidies.map((subsidy) => {
              const { style, textColorClass } = getSubjectColorStyle(subsidy.subject);
              const defaultClass = !subsidy.subject.color ? 'bg-gray-100 text-gray-800' : '';

              return (
                <TableRow key={subsidy.id}>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={defaultClass || `text-xs px-2 py-0.5 ${textColorClass}`}
                      style={style.backgroundColor ? style : undefined}
                    >
                      {formatSubjectShortName(subsidy.subject)}
                    </Badge>
                  </TableCell>
                  <TableCell>{subsidy.billing_type}</TableCell>
                  <TableCell>
                    ${(subsidy.price_cents / 100).toFixed(2)} {subsidy.currency}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const defaultRate = getDefaultHourlyRate(subsidy.billing_type);
                      if (defaultRate === null) {
                        return <span className="text-muted-foreground">N/A</span>;
                      }
                      return `$${(defaultRate / 100).toFixed(2)} ${subsidy.currency}`;
                    })()}
                  </TableCell>
                  <TableCell>{formatDate(subsidy.effective_from)}</TableCell>
                  <TableCell>
                    {subsidy.effective_until ? formatDate(subsidy.effective_until) : 'Indefinitely'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingSubsidy(subsidy)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(subsidy.id)}
                        disabled={deletingId === subsidy.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {editingSubsidy && (
        <EditSubsidyModal
          isOpen={!!editingSubsidy}
          onClose={() => setEditingSubsidy(null)}
          subsidy={editingSubsidy}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}

