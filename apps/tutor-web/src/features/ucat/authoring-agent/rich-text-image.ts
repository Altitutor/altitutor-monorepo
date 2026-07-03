import type { Json } from '@altitutor/shared'

type ImageNodeInput = {
  src: string
  fileId?: string | null
  alt?: string | null
}

function createImageNode(image: ImageNodeInput) {
  return {
    type: 'image',
    attrs: {
      src: image.src,
      ...(image.fileId ? { fileId: image.fileId } : {}),
      alt: image.alt ?? '',
    },
  }
}

export function appendImageNode(value: Json | null | undefined, imageNode: Json): Json {
  const doc = cloneDoc(value)
  const content = Array.isArray(doc.content) ? doc.content : []
  content.push({
    type: 'paragraph',
    content: [imageNode],
  })
  return {
    ...doc,
    type: 'doc',
    content,
  } as Json
}

export function replaceFirstImageNode(value: Json | null | undefined, imageNode: Json): Json {
  const doc = cloneDoc(value)
  let replaced = false

  const visit = (node: unknown): unknown => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node
    const record = node as Record<string, unknown>
    if (!replaced && record.type === 'image') {
      replaced = true
      return imageNode
    }
    if (Array.isArray(record.content)) {
      return {
        ...record,
        content: record.content.map((child) => visit(child)),
      }
    }
    return record
  }

  const nextDoc = visit(doc) as Record<string, unknown>
  return replaced ? nextDoc as Json : appendImageNode(doc as Json, imageNode)
}

function cloneDoc(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? structuredClone(value) as Record<string, unknown>
    : { type: 'doc', content: [] as unknown[] }
}

export function appendImageNodeToDoc(value: Json | null | undefined, image: ImageNodeInput): Json {
  return appendImageNode(value, createImageNode(image) as Json)
}

export function replaceFirstImageNodeInDoc(value: Json | null | undefined, image: ImageNodeInput): Json {
  const doc = cloneDoc(value)
  let replaced = false

  const visit = (node: unknown): unknown => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node
    const record = node as Record<string, unknown>
    if (!replaced && record.type === 'image') {
      replaced = true
      return createImageNode(image)
    }
    if (Array.isArray(record.content)) {
      return {
        ...record,
        content: record.content.map((child) => visit(child)),
      }
    }
    return record
  }

  const nextDoc = visit(doc) as Record<string, unknown>
  return replaced ? nextDoc as Json : appendImageNodeToDoc(doc as Json, image)
}
