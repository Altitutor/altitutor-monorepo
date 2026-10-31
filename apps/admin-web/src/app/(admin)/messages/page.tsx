"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConversationList } from "@/features/messages/components/ConversationList";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";
export default function MessagesPage() {
  const { router } = usePaneNavigation();
  const nextRouter = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    if (!search.has('contact') && !search.has('group') && !search.has('conversation')) return;
    router.push(`/messages?${search}`);
    const params = new URLSearchParams(search.toString());
    for (const key of ['contact','group','conversation']) params.delete(key);
    nextRouter.replace(`/messages${params.size ? `?${params}` : ''}`);
  }, [search, router, nextRouter]);
  return <div className="flex min-h-0 flex-1 flex-col">
    <ConversationList filterScope="page" onSelect={selection => {
      const params = new URLSearchParams(selection.kind === "contact" ? { contact: selection.contactId } : { group: selection.conversationId });
      router.push(`/messages?${params}`);
    }} />
  </div>;
}
