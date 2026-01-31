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
import { Star, StarOff, Loader2 } from 'lucide-react';
import { phoneNumbersApi, type OwnedNumber } from '../api/phone-numbers';

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

  if (numbers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No phone numbers configured
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number/Sender ID</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead className="text-right">Default</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {numbers.map((number) => (
            <TableRow key={number.id}>
              <TableCell className="font-medium">
                {getDisplayValue(number)}
              </TableCell>
              <TableCell>{number.label || '-'}</TableCell>
              <TableCell>
                <Badge variant="outline">{getTypeLabel(number)}</Badge>
              </TableCell>
              <TableCell>
                {number.provider && (
                  <Badge variant="secondary">{number.provider}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {number.is_default ? (
                  <Badge variant="default" className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Default
                  </Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(number.id)}
                    disabled={settingDefault === number.id}
                    className="gap-1"
                  >
                    {settingDefault === number.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                    Set Default
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
