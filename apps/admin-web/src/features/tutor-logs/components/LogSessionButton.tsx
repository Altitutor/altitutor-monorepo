'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { FileText } from 'lucide-react';
import { LogSessionModal } from './LogSessionModal';

type LogSessionButtonProps = {
  currentStaffId: string;
  adminMode?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
};

export function LogSessionButton({
  currentStaffId,
  adminMode = false,
  variant = 'default',
  size = 'default',
}: LogSessionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setIsOpen(true)}>
        <FileText className="h-4 w-4 mr-2" />
        Log Session
      </Button>
      
      <LogSessionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentStaffId={currentStaffId}
        adminMode={adminMode}
      />
    </>
  );
}

