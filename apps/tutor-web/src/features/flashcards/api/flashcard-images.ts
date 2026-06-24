export type UploadFlashcardImageResult = {
  fileId: string;
  storagePath: string;
  signedUrl: string;
};

type UploadResponse = {
  data?: UploadFlashcardImageResult;
  error?: string;
};

export async function uploadFlashcardImage(topicId: string, file: File): Promise<UploadFlashcardImageResult> {
  const formData = new FormData();
  formData.set('topicId', topicId);
  formData.set('file', file);

  const response = await fetch('/api/flashcards/images/upload', {
    method: 'POST',
    body: formData,
  });
  const json = (await response.json()) as UploadResponse;
  if (!response.ok || !json.data) {
    throw new Error(json.error ?? 'Failed to upload flashcard image');
  }
  return json.data;
}
