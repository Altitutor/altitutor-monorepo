'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Edit2 } from 'lucide-react';
import { pricingApi, type BillingPricingRow } from '../api/pricing';

interface BillingPricingTableProps {
  pricing: BillingPricingRow[];
  onUpdate: () => void;
}

export function BillingPricingTable({ pricing, onUpdate }: BillingPricingTableProps) {
  const [editingPricing, setEditingPricing] = useState<BillingPricingRow | null>(null);
  const [hourlyRateCents, setHourlyRateCents] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('AUD');
  const [saving, setSaving] = useState(false);

  const handleEdit = (p: BillingPricingRow) => {
    setEditingPricing(p);
    setHourlyRateCents(p.hourly_rate_cents);
    setCurrency(p.currency);
  };

  const handleSave = async () => {
    if (!editingPricing) return;
    setSaving(true);
    try {
      await pricingApi.updateBillingPricing(editingPricing.billing_type, {
        hourly_rate_cents: hourlyRateCents,
        currency,
      });
      setEditingPricing(null);
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const formatBillingType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Billing Type</TableHead>
              <TableHead>Hourly Rate</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricing.map((p) => (
              <TableRow key={p.billing_type}>
                <TableCell className="font-medium">
                  {formatBillingType(p.billing_type)}
                </TableCell>
                <TableCell>
                  ${(p.hourly_rate_cents / 100).toFixed(2)}/hour
                </TableCell>
                <TableCell>{p.currency}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(p)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {pricing.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No billing pricing configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPricing} onOpenChange={() => setEditingPricing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Billing Pricing</DialogTitle>
            <DialogDescription>
              Update the hourly rate for {editingPricing && formatBillingType(editingPricing.billing_type)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-hourly-rate">Hourly Rate</Label>
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
            <Button variant="outline" onClick={() => setEditingPricing(null)}>
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
