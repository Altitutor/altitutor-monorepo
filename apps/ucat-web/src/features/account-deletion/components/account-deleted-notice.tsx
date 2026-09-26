"use client";

import { useEffect } from "react";
import { useToast } from "@altitutor/ui";

export function AccountDeletedNotice() {
  const { toast } = useToast();

  useEffect(() => {
    toast({
      id: "ucat-account-deleted",
      title: "Account deleted",
      description:
        "Your Altitutor UCAT account has been deleted. Invoices and tutoring records are kept.",
    });
  }, [toast]);

  return null;
}
