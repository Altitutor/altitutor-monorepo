import type { Editor } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import { getMountedEditorView } from '@/features/ucat/shared/lib/mounted-editor-view'

describe('getMountedEditorView', () => {
  it('returns the current view while the editor is mounted', () => {
    const view = { dom: document.createElement('div') } as unknown as EditorView
    const editor = {
      isDestroyed: false,
      get view() {
        return view
      },
    } as Editor

    expect(getMountedEditorView(editor)).toBe(view)
  })

  it('returns null while the editor instance is between mounts', () => {
    const editor = {
      isDestroyed: false,
      get view(): EditorView {
        throw new Error('The editor view is not available')
      },
    } as Editor

    expect(getMountedEditorView(editor)).toBeNull()
  })

  it('does not access the view of a destroyed editor', () => {
    const view = jest.fn()
    const editor = {
      isDestroyed: true,
      get view(): EditorView {
        view()
        throw new Error('unexpected view access')
      },
    } as Editor

    expect(getMountedEditorView(editor)).toBeNull()
    expect(view).not.toHaveBeenCalled()
  })
})
