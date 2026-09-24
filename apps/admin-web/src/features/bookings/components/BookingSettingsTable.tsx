'use client';

import { useState, useEffect } from 'react';
import {
  Input,
  Button,
  Label,
} from '@altitutor/ui';
import { bookingSettingsApi, type BookingSettingsRow } from '../api/settings';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

interface BookingSettingsTableProps {
  settings: BookingSettingsRow[];
  onUpdate: () => void;
}

export function BookingSettingsTable({ settings, onUpdate }: BookingSettingsTableProps) {
  const [editingSetting, setEditingSetting] = useState<BookingSettingsRow | null>(null);
  const [settingValue, setSettingValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingSetting) setSettingValue('');
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

  const columns: SettingsDataTableColumn<BookingSettingsRow>[] = [
    {
      key: 'setting',
      label: 'Setting',
      render: (setting) => <span className="font-medium">{formatSettingKey(setting.setting_key)}</span>,
      sortValue: (setting) => formatSettingKey(setting.setting_key),
      searchValue: (setting) => `${formatSettingKey(setting.setting_key)} ${setting.setting_key}`,
    },
    {
      key: 'description',
      label: 'Description',
      render: (setting) => <span className="text-muted-foreground">{setting.description}</span>,
      sortValue: (setting) => setting.description ?? '',
      searchValue: (setting) => setting.description ?? '',
    },
    {
      key: 'value',
      label: 'Value',
      render: (setting) => setting.setting_value,
      sortValue: (setting) => setting.setting_value,
      searchValue: (setting) => setting.setting_value,
    },
  ];

  return (
    <>
      <SettingsDataTable
        data={settings}
        columns={columns}
        getRowId={(setting) => setting.id}
        emptyMessage="No booking settings configured"
        searchPlaceholder="Search booking settings..."
        filterKeys={[]}
        defaultSort={{ field: 'setting', direction: 'asc' }}
        getActions={(setting) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => handleEdit(setting),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingSetting}
        onClose={() => setEditingSetting(null)}
        title="Edit Booking Setting"
        subtitle={editingSetting ? `${formatSettingKey(editingSetting.setting_key)} - ${editingSetting.description}` : undefined}
        footer={(
          <>
            <Button variant="outline" onClick={() => setEditingSetting(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !settingValue}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        )}
      >
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
      </AdminDialogShell>
    </>
  );
}
