import { EmailThreadView } from "@/features/email/components/EmailThreadView";
export default async function EmailConversationPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <EmailThreadView threadId={params.id} />;
}
