import { AccessoryRoute } from "@/shared/components/accessory-panel/AccessoryRoute";

export default async function EmailConversationPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <AccessoryRoute href={`/email/${encodeURIComponent(id)}`} />;
}
