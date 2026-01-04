'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@altitutor/ui";

interface StaffAvatarProps {
  staffId: string;
  firstName: string;
  lastName: string;
}

export function StaffAvatar({ firstName, lastName }: StaffAvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const fullName = `${firstName} ${lastName}`;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium flex-shrink-0"
          >
            {initials}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{fullName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


