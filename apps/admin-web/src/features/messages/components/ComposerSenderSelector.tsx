'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@altitutor/ui';
import { Phone, Check } from 'lucide-react';
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

  return (
    <div className="flex-shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {canExpand ? (
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
            <Button variant="outline" size="icon" disabled={disabled} type="button" className="h-10" aria-label="Select sender">
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
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {imessageSenders.length > 0 && (
            <>
              <DropdownMenuLabel>iMessage</DropdownMenuLabel>
              {imessageSenders.map((sender) => (
                <DropdownMenuItem
                  key={sender.id}
                  onClick={() => onSelectSender(sender.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{getSenderDisplayName(sender)}</span>
                    {sender.is_default && <span className="text-xs text-muted-foreground">Default</span>}
                  </div>
                  {selectedSenderId === sender.id && <Check className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
          {imessageSenders.length > 0 && twilioSenders.length > 0 && <DropdownMenuSeparator />}
          {twilioSenders.length > 0 && (
            <>
              <DropdownMenuLabel>SMS</DropdownMenuLabel>
              {twilioSenders.map((sender) => (
                <DropdownMenuItem
                  key={sender.id}
                  onClick={() => onSelectSender(sender.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{getSenderDisplayName(sender)}</span>
                    {sender.is_default && <span className="text-xs text-muted-foreground">Default</span>}
                  </div>
                  {selectedSenderId === sender.id && <Check className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
