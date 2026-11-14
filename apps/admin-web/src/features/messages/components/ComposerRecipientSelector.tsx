"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { UserRound } from "lucide-react";

export type ComposerRecipientSelection = {
  options: Array<{ id: string; label: string; detail?: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type DestinationSelection = {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
};

export function ComposerRecipientSelector({
  name,
  recipients,
  addresses,
  disabled,
}: {
  name?: string;
  recipients?: ComposerRecipientSelection;
  addresses?: DestinationSelection;
  disabled?: boolean;
}) {
  const options = recipients?.options ?? [];
  if (!options.length && !addresses) return null;

  const label = options.find(({ id }) => id === recipients?.selectedId)?.label ?? name;
  const recipientName = label && !/^[+\d(). -]+$/.test(label) && !label.includes("@") ? label : "Recipient";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 min-w-0 max-w-36 shrink"
          disabled={disabled}
          aria-label={`Send to ${recipientName}`}
          title={`Send to ${recipientName}`}
        >
          <UserRound className="size-4" aria-hidden />
          <span className="truncate">{recipientName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {recipients && options.length > 0 && (
          <>
            <DropdownMenuLabel>Send to</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={recipients.selectedId ?? ""} onValueChange={recipients.onSelect}>
              {options.map((recipient) => (
                <DropdownMenuRadioItem key={recipient.id} value={recipient.id}>
                  <span className="min-w-0">
                    <span className="block truncate">{recipient.label}</span>
                    {recipient.detail && <span className="block truncate text-xs text-muted-foreground">{recipient.detail}</span>}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {addresses && (
          <>
            {options.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>iMessage address</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={addresses.value} onValueChange={addresses.onChange}>
              {addresses.options.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  <span className="truncate">{option.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
