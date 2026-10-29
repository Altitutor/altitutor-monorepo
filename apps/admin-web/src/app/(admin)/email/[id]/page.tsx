import { EmailThreadView } from "@/features/email/components/EmailThreadView";
export default function EmailConversationPage({ params }: { params: { id: string } }) { return <EmailThreadView threadId={params.id} />; }
