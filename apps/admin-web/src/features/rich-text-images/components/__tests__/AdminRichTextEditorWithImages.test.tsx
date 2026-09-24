import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JSONContent } from '@altitutor/ui';
import { AdminRichTextEditorWithImages } from '../AdminRichTextEditorWithImages';

jest.mock('@altitutor/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockRichTextEditor = React.forwardRef(
    (
      {
        content,
        onChange,
      }: {
        content: JSONContent;
        onChange?: (content: JSONContent) => void;
      },
      _ref,
    ) => (
      <>
        <output data-testid="editor-content">{JSON.stringify(content)}</output>
        <button
          type="button"
          onClick={() =>
            onChange?.({
              ...content,
              content: [
                ...(content.content ?? []),
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'edited' }],
                },
              ],
            })
          }
        >
          Edit
        </button>
      </>
    ),
  );
  MockRichTextEditor.displayName = 'MockRichTextEditor';

  return {
    RichTextEditor: MockRichTextEditor,
  };
});

jest.mock('@/shared/hooks/useSlashCommandSuggestions', () => ({
  useSlashCommandSuggestions: () => [],
}));

jest.mock('../../hooks/useAdminRichTextImageUpload', () => ({
  useAdminRichTextImageUpload: () => ({
    handlePasteImages: jest.fn(),
    handleDrop: jest.fn(),
  }),
}));

describe('AdminRichTextEditorWithImages', () => {
  const expiredSignedUrl =
    'https://example.supabase.co/storage/v1/object/sign/admin-rich-text-images/tasks/example.png?token=expired';
  const freshSignedUrl =
    'https://example.supabase.co/storage/v1/object/sign/admin-rich-text-images/tasks/example.png?token=fresh';

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ signedUrls: [freshSignedUrl] }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes a persisted signed image URL before giving content to the editor', async () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: expiredSignedUrl },
        },
      ],
    };

    render(
      <AdminRichTextEditorWithImages
        content={content}
        onChange={jest.fn()}
        context="tasks"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('editor-content')).toHaveTextContent(
        freshSignedUrl,
      );
    });
    expect(screen.getByTestId('editor-content')).toHaveTextContent(
      '"storagePath":"tasks/example.png"',
    );

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/rich-text-images/signed-urls',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ paths: ['tasks/example.png'], fileIds: [] }),
      }),
    );
  });

  it('recovers an image from its durable file id when the stored URL is unusable', async () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            src: 'https://obsolete-host.example/image.png',
            fileId: 'file-1',
          },
        },
      ],
    };

    render(
      <AdminRichTextEditorWithImages
        content={content}
        onChange={jest.fn()}
        context="tasks"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('editor-content')).toHaveTextContent(
        freshSignedUrl,
      );
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/rich-text-images/signed-urls',
      expect.objectContaining({
        body: JSON.stringify({ paths: [], fileIds: ['file-1'] }),
      }),
    );
  });

  it('does not restart the URL refresh when the parent echoes a local edit', async () => {
    function ControlledEditor() {
      const [content, setContent] = useState<JSONContent>({
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'https://example.supabase.co/storage/v1/object/sign/admin-rich-text-images/tasks/echo.png?token=expired',
            },
          },
        ],
      });

      return (
        <AdminRichTextEditorWithImages
          content={content}
          onChange={setContent}
          context="tasks"
        />
      );
    }

    render(<ControlledEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('editor-content')).toHaveTextContent(
        freshSignedUrl,
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => {
      expect(screen.getByTestId('editor-content')).toHaveTextContent('edited');
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
