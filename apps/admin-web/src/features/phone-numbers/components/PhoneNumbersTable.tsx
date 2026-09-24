'use client';

import { useState } from 'react';
import {
  Badge,
} from '@altitutor/ui';
import { Star } from 'lucide-react';
import { phoneNumbersApi, type OwnedNumber } from '../api/phone-numbers';
import { SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

interface PhoneNumbersTableProps {
  numbers: OwnedNumber[];
  onUpdate: () => void;
}

export function PhoneNumbersTable({ numbers, onUpdate }: PhoneNumbersTableProps) {
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  const handleSetDefault = async (numberId: string) => {
    setSettingDefault(numberId);
    try {
      await phoneNumbersApi.setDefaultNumber(numberId);
      onUpdate();
    } catch (error) {
      alert('Failed to set default number: ' + (error as Error).message);
    } finally {
      setSettingDefault(null);
    }
  };

  const getDisplayValue = (number: OwnedNumber): string => {
    if (number.sender_type === 'ALPHANUMERIC') {
      return number.alphanumeric_sender_id || number.label || 'Unknown';
    }
    return number.phone_e164 || number.label || 'Unknown';
  };

  const getTypeLabel = (number: OwnedNumber): string => {
    if (number.sender_type === 'ALPHANUMERIC') {
      return 'Alphanumeric';
    }
    return number.provider === 'IMESSAGE' ? 'iMessage' : 'Twilio';
  };

  const columns: SettingsDataTableColumn<OwnedNumber>[] = [
    {
      key: 'number',
      label: 'Number/Sender ID',
      render: (number) => <span className="font-medium">{getDisplayValue(number)}</span>,
      sortValue: getDisplayValue,
      searchValue: getDisplayValue,
    },
    {
      key: 'label',
      label: 'Label',
      render: (number) => number.label || '-',
      sortValue: (number) => number.label || '',
      searchValue: (number) => number.label || '',
    },
    {
      key: 'type',
      label: 'Type',
      render: (number) => <Badge variant="outline">{getTypeLabel(number)}</Badge>,
      sortValue: getTypeLabel,
      filterValue: getTypeLabel,
      searchValue: getTypeLabel,
    },
    {
      key: 'provider',
      label: 'Provider',
      render: (number) => number.provider ? <Badge variant="secondary">{number.provider}</Badge> : '-',
      sortValue: (number) => number.provider || '',
      filterValue: (number) => number.provider || '',
      searchValue: (number) => number.provider || '',
    },
    {
      key: 'default',
      label: 'Default',
      className: 'text-right',
      render: (number) =>
        number.is_default ? (
          <Badge variant="default" className="gap-1">
            <Star className="h-3 w-3 fill-current" />
            Default
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortValue: (number) => number.is_default,
      filterValue: (number) => number.is_default ? 'default' : 'not-default',
      searchValue: (number) => number.is_default ? 'default' : '',
    },
  ];

  return (
    <SettingsDataTable
      data={numbers}
      columns={columns}
      getRowId={(number) => number.id}
      emptyMessage="No phone numbers configured"
      searchPlaceholder="Search phone numbers..."
      filterKeys={['type', 'provider', 'default']}
      filterDefinitions={[
        {
          key: 'type',
          label: 'Type',
          options: ['Alphanumeric', 'iMessage', 'Twilio'].map((value) => ({ label: value, value })),
        },
        {
          key: 'provider',
          label: 'Provider',
          options: Array.from(new Set(numbers.map((number) => number.provider).filter(Boolean))).map((value) => ({
            label: String(value),
            value: String(value),
          })),
        },
        {
          key: 'default',
          label: 'Default',
          options: [
            { label: 'Default', value: 'default' },
            { label: 'Not default', value: 'not-default' },
          ],
        },
      ]}
      defaultSort={{ field: 'number', direction: 'asc' }}
      getActions={(number) => [
        {
          id: 'set-default',
          label: 'Set default',
          disabled: number.is_default || settingDefault === number.id,
          onSelect: () => handleSetDefault(number.id),
        },
      ]}
    />
  );
}
