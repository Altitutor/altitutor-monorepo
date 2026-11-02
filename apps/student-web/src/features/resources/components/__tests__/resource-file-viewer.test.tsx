import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResourceFileViewer } from '../resource-file-viewer';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock('../resource-pdf-pages', () => ({
  ResourcePdfPages: ({
    url,
    filename,
    onReady,
  }: {
    url: string;
    filename: string;
    onReady?: (loadedUrl: string) => void;
  }) => (
    <button
      type="button"
      data-testid="paginated-pdf"
      data-url={url}
      data-filename={filename}
      onClick={() => onReady?.(url)}
    />
  ),
}));

const pdfViewerProps = {
  filename: 'notes.pdf',
  mimetype: 'application/pdf',
  resourceType: 'NOTES',
  externalUrl: null,
};

describe('ResourceFileViewer', () => {
  it('renders PDFs with the paginated viewer on every device', () => {
    render(
      <ResourceFileViewer
        {...pdfViewerProps}
        signedUrl="https://example.com/notes.pdf"
      />,
    );

    expect(screen.queryByTitle('notes.pdf')).not.toBeInTheDocument();
    expect(screen.getByTestId('paginated-pdf')).toHaveAttribute(
      'data-url',
      'https://example.com/notes.pdf',
    );
  });

  it('accepts refreshed URLs until the PDF is ready, then preserves the rendered document', () => {
    const { rerender } = render(
      <ResourceFileViewer {...pdfViewerProps} signedUrl="https://example.com/expired.pdf" />,
    );

    rerender(<ResourceFileViewer {...pdfViewerProps} signedUrl="https://example.com/fresh.pdf" />);
    expect(screen.getByTestId('paginated-pdf')).toHaveAttribute('data-url', 'https://example.com/fresh.pdf');

    fireEvent.click(screen.getByTestId('paginated-pdf'));
    rerender(<ResourceFileViewer {...pdfViewerProps} signedUrl="https://example.com/renewed.pdf" />);
    expect(screen.getByTestId('paginated-pdf')).toHaveAttribute('data-url', 'https://example.com/fresh.pdf');

    rerender(
      <ResourceFileViewer {...pdfViewerProps} filename="other.pdf" signedUrl="https://example.com/other.pdf" />,
    );
    expect(screen.getByTestId('paginated-pdf')).toHaveAttribute('data-url', 'https://example.com/other.pdf');
  });

  it('does not import pdfjs-dist or react-pdf (Next webpack cannot bundle them)', () => {
    const source = readFileSync(
      join(__dirname, '../resource-pdf-pages.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/from ['"]pdfjs-dist['"]/);
    expect(source).not.toMatch(/from ['"]react-pdf['"]/);
    expect(source).not.toMatch(/import\(['"]pdfjs-dist/);
    expect(source).not.toMatch(/import\(['"]react-pdf/);
    expect(source).toContain('/pdfjs/pdf.min.mjs');
  });
});
