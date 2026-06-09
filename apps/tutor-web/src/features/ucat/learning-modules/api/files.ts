export type LearningModuleFileUploadResult = {
  fileId: string
  filename: string
  signedUrl: string
}

export async function uploadLearningModuleFile(
  moduleId: string,
  file: File,
): Promise<LearningModuleFileUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('moduleId', moduleId)

  const response = await fetch('/api/ucat/learning-modules/files/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Failed to upload file')
  }

  return response.json() as Promise<LearningModuleFileUploadResult>
}
