import {
  docStructureFingerprint,
  refreshUcatImageUrls,
} from '../refresh-ucat-image-urls'

function docWithImages(fileIds: string[]) {
  return {
    type: 'doc',
    content: fileIds.flatMap((fileId, index) => [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: `text ${index + 1}` }],
      },
      {
        type: 'image',
        attrs: {
          src: `https://example.com/${fileId}?token=old`,
          fileId,
        },
      },
    ]),
  }
}

describe('docStructureFingerprint', () => {
  it('changes when an image block is removed', () => {
    const before = docWithImages(['img-a', 'img-b', 'img-c'])
    const after = {
      type: 'doc',
      content: (before.content as unknown[]).filter(
        (node) =>
          !(
            typeof node === 'object' &&
            node != null &&
            (node as { type?: string; attrs?: { fileId?: string } }).type === 'image' &&
            (node as { attrs?: { fileId?: string } }).attrs?.fileId === 'img-b'
          ) &&
          !(
            typeof node === 'object' &&
            node != null &&
            (node as { type?: string; content?: { text?: string }[] }).type === 'paragraph' &&
            (node as { content?: { text?: string }[] }).content?.[0]?.text === 'text 2'
          )
      ),
    }

    expect(docStructureFingerprint(before)).not.toBe(docStructureFingerprint(after))
  })

  it('ignores signed URL changes on the same structure', () => {
    const docA = docWithImages(['img-a'])
    const docB = {
      ...docA,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'text 1' }] },
        {
          type: 'image',
          attrs: {
            src: 'https://example.com/img-a?token=new',
            fileId: 'img-a',
          },
        },
      ],
    }

    expect(docStructureFingerprint(docA)).toBe(docStructureFingerprint(docB))
  })
})

describe('refreshUcatImageUrls', () => {
  it('assigns refreshed URLs to images in document order', async () => {
    const doc = docWithImages(['img-a', 'img-b'])
    const refreshed = await refreshUcatImageUrls(
      doc,
      async (path) => `https://fresh.example/${path}`,
      async (fileId) => `https://fresh.example/by-id/${fileId}`
    )

    const images: string[] = []
    const walk = (node: Record<string, unknown>): void => {
      if (node.type === 'image' && node.attrs && typeof node.attrs === 'object') {
        const src = (node.attrs as Record<string, unknown>).src
        if (typeof src === 'string') images.push(src)
        return
      }
      const content = node.content
      if (Array.isArray(content)) {
        for (const child of content) {
          if (child && typeof child === 'object') walk(child as Record<string, unknown>)
        }
      }
    }
    walk(refreshed)

    expect(images).toEqual([
      'https://fresh.example/by-id/img-a',
      'https://fresh.example/by-id/img-b',
    ])
  })
})
