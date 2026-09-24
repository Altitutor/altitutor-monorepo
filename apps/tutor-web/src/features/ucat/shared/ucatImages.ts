export interface UploadUcatImageParams {
  file: File
  stemId?: string | null
}

export interface UploadUcatImageResult {
  fileId: string
  storagePath: string
  signedUrl: string
}

export async function uploadUcatImage(params: UploadUcatImageParams): Promise<UploadUcatImageResult> {
  const form = new FormData()
  form.set('file', params.file)
  if (params.stemId) form.set('stemId', params.stemId)
  const response = await fetch('/api/ucat/images', { method: 'POST', body: form })
  if (!response.ok) throw new Error('Failed to upload UCAT image')
  return await response.json() as UploadUcatImageResult
}

export async function deleteUcatImagesByFileIds(fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return

  const response = await fetch('/api/ucat/images', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  })
  if (!response.ok) throw new Error('Failed to delete UCAT images')
}
