import { useQuery } from '@tanstack/react-query';
import { documentationApi } from '../api/documentation';

export function useTutorDocumentationFolders() {
  return useQuery({
    queryKey: ['tutor-documentation', 'folders'],
    queryFn: documentationApi.listFolders,
  });
}

export function useTutorDocumentationDocuments() {
  return useQuery({
    queryKey: ['tutor-documentation', 'documents'],
    queryFn: documentationApi.listDocuments,
  });
}

export function useTutorDocumentationDocument(documentId: string | null) {
  return useQuery({
    queryKey: ['tutor-documentation', 'document', documentId],
    queryFn: () => {
      if (!documentId) throw new Error('Document ID is required');
      return documentationApi.getDocument(documentId);
    },
    enabled: Boolean(documentId),
  });
}
