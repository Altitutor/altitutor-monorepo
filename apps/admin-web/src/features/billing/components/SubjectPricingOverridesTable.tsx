'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
} from '@altitutor/ui';
import { Edit2, Trash2, Plus, Search } from 'lucide-react';
import { subjectPricingOverridesApi, type SubjectPricingOverrideRow, type CreateSubjectOverrideInput } from '../api/subject-pricing-overrides';
import { subjectsApi } from '@/features/subjects/api/subjects';
import type { Tables } from '@altitutor/shared';

interface SubjectPricingOverridesTableProps {
  overrides: SubjectPricingOverrideRow[];
  onUpdate: () => void;
}

export function SubjectPricingOverridesTable({ overrides, onUpdate }: SubjectPricingOverridesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOverride, setEditingOverride] = useState<SubjectPricingOverrideRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [hourlyRateCents, setHourlyRateCents] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('AUD');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedBillingType, setSelectedBillingType] = useState<'CLASS' | 'EXAM_COURSE' | 'DRAFTING'>('CLASS');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Tables<'subjects'>[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Load subjects for dropdown
  const loadSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const data = await subjectsApi.getAllSubjects();
      setSubjects(data);
    } catch (e) {
      alert('Failed to load subjects: ' + (e as Error).message);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return overrides;
    const lower = searchTerm.toLowerCase();
    return overrides.filter(
      (o) =>
        o.subject.name.toLowerCase().includes(lower) ||
        o.billing_type.toLowerCase().includes(lower)
    );
  }, [overrides, searchTerm]);

  const handleEdit = (override: SubjectPricingOverrideRow) => {
    setEditingOverride(override);
    setHourlyRateCents(override.hourly_rate_cents);
    setCurrency(override.currency);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setSelectedSubjectId('');
    setSelectedBillingType('CLASS');
    setHourlyRateCents(0);
    setCurrency('AUD');
    loadSubjects();
  };

  const handleSave = async () => {
    if (!editingOverride) return;
    setSaving(true);
    try {
      await subjectPricingOverridesApi.updateSubjectOverride(editingOverride.id, {
        hourly_rate_cents: hourlyRateCents,
        currency,
      });
      setEditingOverride(null);
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSave = async () => {
    if (!selectedSubjectId) {
      alert('Please select a subject');
      return;
    }
    setSaving(true);
    try {
      await subjectPricingOverridesApi.createSubjectOverride({
        subject_id: selectedSubjectId,
        billing_type: selectedBillingType,
        hourly_rate_cents: hourlyRateCents,
        currency,
      });
      setIsCreating(false);
      onUpdate();
    } catch (e) {
      alert('Failed to create: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (overrideId: string) => {
    if (!confirm('Are you sure you want to delete this override?')) return;
    setDeleting(overrideId);
    try {
      await subjectPricingOverridesApi.deleteSubjectOverride(overrideId);
      onUpdate();
    } catch (e) {
      alert('Failed to delete: ' + (e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const formatSubjectName = (subject: SubjectPricingOverrideRow['subject']): string => {
    const parts: string[] = [];
    if (subject.curriculum) parts.push(subject.curriculum);
    if (subject.year_level != null) parts.push(`Year ${subject.year_level}`);
    parts.push(subject.name);
    return parts.join(' ');
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject name or billing type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Override
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Billing Type</TableHead>
              <TableHead>Hourly Rate (AUD)</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((override) => (
              <TableRow key={override.id}>
                <TableCell className="font-medium">
                  {formatSubjectName(override.subject)}
                </TableCell>
                <TableCell>{override.billing_type}</TableCell>
                <TableCell>
                  ${(override.hourly_rate_cents / 100).toFixed(2)}/hour
                </TableCell>
                <TableCell>{override.currency}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(override)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(override.id)}
                      disabled={deleting === override.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {searchTerm ? 'No overrides found matching your search' : 'No subject pricing overrides yet'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingOverride} onOpenChange={() => setEditingOverride(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pricing Override</DialogTitle>
            <DialogDescription>
              Update the hourly rate override for {editingOverride && formatSubjectName(editingOverride.subject)} ({editingOverride?.billing_type})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-hourly-rate">Hourly Rate (AUD)</Label>
              <Input
                id="edit-hourly-rate"
                type="number"
                step="0.01"
                value={(hourlyRateCents / 100).toFixed(2)}
                onChange={(e) =>
                  setHourlyRateCents(Math.round(Number(e.target.value) * 100))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="edit-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUD">AUD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOverride(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Pricing Override</DialogTitle>
            <DialogDescription>
              Create a subject-specific hourly rate override
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-subject">Subject</Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} disabled={loadingSubjects}>
                <SelectTrigger id="create-subject">
                  <SelectValue placeholder={loadingSubjects ? 'Loading subjects...' : 'Select a subject'} />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => {
                    const name = [
                      subject.curriculum,
                      subject.year_level ? `Year ${subject.year_level}` : null,
                      subject.name
                    ].filter(Boolean).join(' ');
                    return (
                      <SelectItem key={subject.id} value={subject.id}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-billing-type">Billing Type</Label>
              <Select value={selectedBillingType} onValueChange={(value) => setSelectedBillingType(value as 'CLASS' | 'EXAM_COURSE' | 'DRAFTING')}>
                <SelectTrigger id="create-billing-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLASS">CLASS</SelectItem>
                  <SelectItem value="EXAM_COURSE">EXAM_COURSE</SelectItem>
                  <SelectItem value="DRAFTING">DRAFTING</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-hourly-rate">Hourly Rate (AUD)</Label>
              <Input
                id="create-hourly-rate"
                type="number"
                step="0.01"
                value={(hourlyRateCents / 100).toFixed(2)}
                onChange={(e) =>
                  setHourlyRateCents(Math.round(Number(e.target.value) * 100))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="create-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUD">AUD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSave} disabled={saving || !selectedSubjectId}>
              {saving ? 'Creating...' : 'Create Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

