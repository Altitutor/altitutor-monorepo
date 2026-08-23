import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ResourceFileViewer } from '../resource-file-viewer';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock('../resource-pdf-pages', () => ({
  ResourcePdfPages: ({ url, filename }: { url: string; filename: string }) => (
    <div data-testid="paginated-pdf" data-url={url} data-filename={filename} />
  ),
}));

describe('ResourceFileViewer', () => {
  it('renders PDFs with the paginated viewer on every device', () => {
    render(
      <ResourceFileViewer
        filename="notes.pdf"
        mimetype="application/pdf"
        resourceType="NOTES"
        externalUrl={null}
        signedUrl="https://example.com/notes.pdf"
      />,
    );

    expect(screen.queryByTitle('notes.pdf')).not.toBeInTheDocument();
    expect(screen.getByTestId('paginated-pdf')).toHaveAttribute('data-url', 'https://example.com/notes.pdf');
  });

  it('does not import pdfjs-dist or react-pdf (Next webpack cannot bundle them)', () => {
    const source = readFileSync(join(__dirname, '../resource-pdf-pages.tsx'), 'utf8');
    expect(source).not.toMatch(/from ['"]pdfjs-dist['"]/);
    expect(source).not.toMatch(/from ['"]react-pdf['"]/);
    expect(source).not.toMatch(/import\(['"]pdfjs-dist/);
    expect(source).not.toMatch(/import\(['"]react-pdf/);
    expect(source).toContain('/pdfjs/pdf.min.mjs');
  });
});
