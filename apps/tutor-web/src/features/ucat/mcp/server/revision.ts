type RevisionPayload = {
  id: string
  updatedAt: string
}

export function encodeAuthoringRevision(id: string, updatedAt: string): string {
  const payload: RevisionPayload = { id, updatedAt }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeAuthoringRevision(revision: string, expectedId: string): string {
  try {
    const parsed = JSON.parse(
      Buffer.from(revision, 'base64url').toString('utf8'),
    ) as Partial<RevisionPayload>
    if (
      parsed.id !== expectedId
      || typeof parsed.updatedAt !== 'string'
      || Number.isNaN(Date.parse(parsed.updatedAt))
    ) {
      throw new Error('Revision does not match this aggregate')
    }
    return parsed.updatedAt
  } catch (error) {
    if (error instanceof Error && error.message === 'Revision does not match this aggregate') {
      throw error
    }
    throw new Error('Invalid authoring revision')
  }
}

