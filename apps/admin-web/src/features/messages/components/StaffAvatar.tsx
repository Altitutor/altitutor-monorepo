'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@altitutor/ui";

interface StaffAvatarProps {
  staffId: string;
  firstName: string;
  lastName: string;
}

// Generate a consistent color from staff ID
function getColorFromId(id: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export function StaffAvatar({ staffId, firstName, lastName }: StaffAvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const bgColor = getColorFromId(staffId);
  const fullName = `${firstName} ${lastName}`;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`w-6 h-6 rounded-full ${bgColor} flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}
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

