'use client';

import { useState, useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
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
import { Edit2, Search } from 'lucide-react';
import { pricingApi } from '../api/pricing';

type SubjectRow = Tables<'subjects'>;

interface PricingTableProps {
  subjects: SubjectRow[];
  onUpdate: () => void;
}

export function PricingTable({ subjects, onUpdate }: PricingTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);
  const [sessionFeeCents, setSessionFeeCents] = useState<number>(0);
  const [billingType, setBillingType] = useState<string>('CLASS');
  const [currency, setCurrency] = useState<string>('AUD');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!searchTerm) return subjects;
    const lower = searchTerm.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.level?.toLowerCase().includes(lower)
    );
  }, [subjects, searchTerm]);

  const handleEdit = (subject: SubjectRow) => {
    setEditingSubject(subject);
    setSessionFeeCents(subject.session_fee_cents);
    setBillingType(subject.billing_type);
    setCurrency(subject.currency);
  };

  const handleSave = async () => {
    if (!editingSubject) return;
    setSaving(true);
    try {
      await pricingApi.updateSubjectPricing(editingSubject.id, {
        session_fee_cents: sessionFeeCents,
        billing_type: billingType,
        currency,
      });
      setEditingSubject(null);
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Year / Level</TableHead>
              <TableHead>Billing Type</TableHead>
              <TableHead>Session Fee (AUD)</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((subject) => (
              <TableRow key={subject.id}>
                <TableCell className="font-medium">{subject.name}</TableCell>
                <TableCell>
                  {subject.year_level ? `Year ${subject.year_level}` : ''}{' '}
                  {subject.level ? `(${subject.level})` : ''}
                </TableCell>
                <TableCell>{subject.billing_type}</TableCell>
                <TableCell>
                  ${(subject.session_fee_cents / 100).toFixed(2)}
                </TableCell>
                <TableCell>{subject.currency}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(subject)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingSubject} onOpenChange={() => setEditingSubject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pricing</DialogTitle>
            <DialogDescription>
              Update the session fee and billing type for {editingSubject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="billing-type">Billing Type</Label>
              <Select value={billingType} onValueChange={setBillingType}>
                <SelectTrigger id="billing-type">
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
              <Label htmlFor="session-fee">Session Fee (AUD)</Label>
              <Input
                id="session-fee"
                type="number"
                step="0.01"
                value={(sessionFeeCents / 100).toFixed(2)}
                onChange={(e) =>
                  setSessionFeeCents(Math.round(Number(e.target.value) * 100))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
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
            <Button variant="outline" onClick={() => setEditingSubject(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


