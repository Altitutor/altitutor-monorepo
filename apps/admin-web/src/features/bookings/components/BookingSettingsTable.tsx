'use client';

import { useState, useEffect } from 'react';
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
} from '@altitutor/ui';
import { Edit2 } from 'lucide-react';
import { bookingSettingsApi, type BookingSettingsRow } from '../api/settings';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

interface BookingSettingsTableProps {
  settings: BookingSettingsRow[];
  onUpdate: () => void;
}

export function BookingSettingsTable({ settings, onUpdate }: BookingSettingsTableProps) {
  const [editingSetting, setEditingSetting] = useState<BookingSettingsRow | null>(null);
  const [settingValue, setSettingValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!editingSetting) setExpanded(false);
  }, [editingSetting]);

  const handleEdit = (setting: BookingSettingsRow) => {
    setEditingSetting(setting);
    setSettingValue(setting.setting_value);
  };

  const handleSave = async () => {
    if (!editingSetting) return;
    setSaving(true);
    try {
      await bookingSettingsApi.updateBookingSetting(editingSetting.setting_key, settingValue);
      setEditingSetting(null);
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const formatSettingKey = (key: string) => {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setting</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.map((setting) => (
              <TableRow key={setting.id}>
                <TableCell className="font-medium">
                  {formatSettingKey(setting.setting_key)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {setting.description}
                </TableCell>
                <TableCell>{setting.setting_value}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(setting)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {settings.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No booking settings configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSetting} onOpenChange={(open) => !open && setEditingSetting(null)}>
        <DialogContent
          className={cn(
            EXPANDABLE_DIALOG_TRANSITION,
            expanded && EXPANDED_DIALOG_CONTENT_CLASS
          )}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle>Edit Booking Setting</DialogTitle>
                <DialogDescription>
              {editingSetting && (
                <>
                  Update {formatSettingKey(editingSetting.setting_key)}
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {editingSetting.description}
                  </span>
                </>
            )}
          </DialogDescription>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-setting-value">Value</Label>
              <Input
                id="edit-setting-value"
                type="text"
                value={settingValue}
                onChange={(e) => setSettingValue(e.target.value)}
                placeholder="Enter setting value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSetting(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !settingValue}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
