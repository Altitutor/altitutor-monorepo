import { TutorDocumentationPage } from '@/features/documentation';

export default async function DocumentationDocumentPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  return <TutorDocumentationPage selectedDocumentId={params.id} />;
}
