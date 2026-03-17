'use client';

import { useMemo } from 'react';
import { Button, SearchableSelect } from '@altitutor/ui';
import { Phone } from 'lucide-react';
import type { Sender } from '../api/queries';

interface ComposerSenderSelectorProps {
  availableSenders: Sender[];
  selectedSenderId: string | null;
  onSelectSender: (senderId: string) => void;
  canExpand: boolean;
  disabled: boolean;
}

function getSenderDisplayName(sender: Sender | undefined): string {
  if (!sender) return 'Select sender';
  if (sender.sender_type === 'ALPHANUMERIC') {
    return sender.alphanumeric_sender_id || sender.label || 'Unknown';
  }
  return sender.phone_e164 || sender.label || 'Unknown';
}

export function ComposerSenderSelector({
  availableSenders,
  selectedSenderId,
  onSelectSender,
  canExpand,
  disabled,
}: ComposerSenderSelectorProps) {
  const selectedSender = availableSenders.find((s) => s.id === selectedSenderId);
  const imessageSenders = availableSenders.filter((s) => s.provider === 'IMESSAGE');
  const twilioSenders = availableSenders.filter((s) => s.provider === 'TWILIO');

  const groups = useMemo(() => {
    const result: { label: string; items: Sender[] }[] = [];
    if (imessageSenders.length > 0) {
      result.push({ label: 'iMessage', items: imessageSenders });
    }
    if (twilioSenders.length > 0) {
      result.push({ label: 'SMS', items: twilioSenders });
    }
    return result;
  }, [imessageSenders, twilioSenders]);

  const trigger = canExpand ? (
    <Button variant="outline" size="sm" disabled={disabled} type="button" className="h-10">
      <Phone
        className={`h-4 w-4 mr-2 ${
          selectedSender?.provider === 'IMESSAGE'
            ? 'text-[#007AFF] dark:text-[#0A84FF]'
            : selectedSender?.provider === 'TWILIO'
              ? 'text-[#30D158] dark:text-[#1E8E3E]'
              : ''
        }`}
      />
      {selectedSender ? getSenderDisplayName(selectedSender) : 'Phone'}
    </Button>
  ) : (
    <Button
      variant="outline"
      size="icon"
      disabled={disabled}
      type="button"
      className="h-10"
      aria-label="Select sender"
    >
      <Phone
        className={`h-4 w-4 ${
          selectedSender?.provider === 'IMESSAGE'
            ? 'text-[#007AFF] dark:text-[#0A84FF]'
            : selectedSender?.provider === 'TWILIO'
              ? 'text-[#30D158] dark:text-[#1E8E3E]'
              : ''
        }`}
      />
    </Button>
  );

  return (
    <div className="flex-shrink-0">
      <SearchableSelect<Sender>
        items={[]}
        groups={groups}
        value={selectedSender ?? null}
        onValueChange={(sender) => sender && onSelectSender(sender.id)}
        getItemId={(s) => s.id}
        getItemLabel={getSenderDisplayName}
        getItemValue={(s) =>
          `${getSenderDisplayName(s)} ${s.label ?? ''} ${s.phone_e164 ?? ''}`.trim()
        }
        placeholder="Select sender"
        searchPlaceholder="Search senders..."
        emptyMessage="No senders found"
        trigger={trigger}
        disabled={disabled}
        contentWidth="320px"
        align="start"
        renderItem={(sender, isSelected) => (
          <div className="flex flex-col items-start w-full">
            <span className={isSelected ? 'font-medium' : ''}>
              {getSenderDisplayName(sender)}
            </span>
            {sender.is_default && (
              <span className="text-xs text-muted-foreground">Default</span>
            )}
          </div>
        )}
      />
    </div>
  );
}
