import { TutorDocumentationPage } from '@/features/documentation';

export default function DocumentationDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  return <TutorDocumentationPage selectedDocumentId={params.id} />;
}
