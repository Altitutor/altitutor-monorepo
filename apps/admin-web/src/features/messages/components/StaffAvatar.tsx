'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@altitutor/ui";

interface StaffAvatarProps {
  staffId: string;
  firstName: string;
  lastName: string;
}

function MessageAuthorAvatar({ initials, label }: { initials: string; label: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-label={label}
            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium flex-shrink-0"
          >
            {initials}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StaffAvatar({ firstName, lastName }: StaffAvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const fullName = `${firstName} ${lastName}`;

  return <MessageAuthorAvatar initials={initials} label={fullName} />;
}

export function SystemAvatar() {
  return <MessageAuthorAvatar initials="S" label="System" />;
}
