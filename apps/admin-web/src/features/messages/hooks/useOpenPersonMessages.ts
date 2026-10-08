"use client";

import { useState } from "react";
import { useToast } from "@altitutor/ui";
import { useAccessoryPanelActions } from "@/shared/contexts/AccessoryPanelContext";
import {
  ensureContactForStudent,
  ensureContactForParent,
  ensureContactForStaff,
} from "../utils/contactHelpers";

const ensureContact = {
  student: ensureContactForStudent,
  parent: ensureContactForParent,
  staff: ensureContactForStaff,
};

export function useOpenPersonMessages(
  type: "student" | "parent" | "staff" | null,
  id?: string,
  title?: string,
) {
  const panel = useAccessoryPanelActions();
  const { toast } = useToast();
  const [isOpening, setIsOpening] = useState(false);
  const openMessages = async () => {
    if (!type || !id || !panel || isOpening) return;
    setIsOpening(true);
    try {
      const contactId = await ensureContact[type](id, { allowEmail: true });
      if (!contactId) {
        toast({
          title: "Unable to open messages",
          description:
            "This person needs a phone number or email address to message.",
          variant: "destructive",
        });
        return;
      }
      panel.openTab({
        kind: "messages",
        id: contactId,
        title: title || "Messages",
        query: `contact=${encodeURIComponent(contactId)}`,
      });
    } catch {
      toast({
        title: "Unable to open messages",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsOpening(false);
    }
  };
  return { openMessages, isOpening, available: Boolean(type && id && panel) };
}
