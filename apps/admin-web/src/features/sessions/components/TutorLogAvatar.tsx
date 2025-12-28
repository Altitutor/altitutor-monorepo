'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@altitutor/ui";

interface TutorLogAvatarProps {
  firstName: string;
  lastName: string;
}

export function TutorLogAvatar({ firstName, lastName }: TutorLogAvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const fullName = `${firstName} ${lastName}`;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium flex-shrink-0 cursor-help"
            title={`Tutor log submitted by ${fullName}`}
          >
            {initials}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tutor log submitted by {fullName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

