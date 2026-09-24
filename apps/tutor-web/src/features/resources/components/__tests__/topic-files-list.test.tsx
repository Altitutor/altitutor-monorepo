import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TopicFilesList } from '../topic-files-list';
import type { TutorResourceFile } from '../../lib/types';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock('@altitutor/ui', () => {
  return {
    clickableCardHoverCn: 'hover-card',
    clickableCardFocusWithinCn: 'focus-card',
    ClickableCardIcon: () => <span data-testid="file-icon" />,
    ClickableCardRevealChevron: () => <span data-testid="file-chevron" />,
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => (
      <button {...props}>{children}</button>
    ),
    DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
    DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    DropdownMenuItem: ({
      children,
      onSelect,
      asChild,
    }: React.PropsWithChildren<{ onSelect?: () => void; asChild?: boolean }>) =>
      asChild ? (
        <>{children}</>
      ) : (
        <button type="button" onClick={onSelect}>
          {children}
        </button>
      ),
    Dialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  };
});

jest.mock('../resource-file-preview-dialog', () => ({
  ResourceFilePreviewDialog: ({
    file,
    open,
  }: {
    file: { filename: string } | null;
    open: boolean;
  }) => (open && file ? <div role="dialog">{file.filename}</div> : null),
}));

jest.mock('@/features/office-print/components/OfficePrintConfirmDialog', () => ({
  OfficePrintConfirmDialog: () => null,
}));

jest.mock('@/features/office-print/hooks/useTutorOfficePrintAccess', () => ({
  useTutorOfficePrintAccess: () => ({ access: 'office_hours', isLoading: false }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function file(overrides: Partial<TutorResourceFile>): TutorResourceFile {
  return {
    id: 'primary-1',
    topicId: 'topic-1',
    code: '1.1N.1',
    type: 'NOTES',
    index: 1,
    filename: 'notes.pdf',
    mimetype: 'application/pdf',
    storagePath: 'path/notes.pdf',
    bucket: 'files',
    externalUrl: null,
    isSolutions: false,
    isSolutionsOfId: null,
    fileId: 'file-1',
    ...overrides,
  };
}

describe('TopicFilesList', () => {
  it('opens a preview dialog from the file card instead of linking to the page', () => {
    render(
      <TopicFilesList
        files={[file({})]}
        getFileHref={(code) => `/resources/12biol/1.1/${code.toLowerCase()}`}
      />,
    );

    expect(screen.queryByRole('link', { name: /preview notes\.pdf/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview notes.pdf' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('notes.pdf');
  });

  it('renders the solution as its own card and keeps an actions menu', () => {
    render(
      <TopicFilesList
        files={[
          file({}),
          file({
            id: 'solution-1',
            code: '1.1N.1S',
            filename: 'notes-solutions.pdf',
            isSolutions: true,
            isSolutionsOfId: 'primary-1',
            fileId: 'file-2',
          }),
        ]}
        getFileHref={(code) => `/resources/12biol/1.1/${code.toLowerCase()}`}
      />,
    );

    expect(screen.getByText('Solution')).toBeInTheDocument();
    expect(screen.getByText('1.1N.1S · notes-solutions.pdf')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Actions' })).toHaveLength(2);
    const pageLinks = screen.getAllByRole('link', { name: 'Open in page' });
    expect(pageLinks[0]).toHaveAttribute('href', '/resources/12biol/1.1/1.1n.1');
  });

  it('does not use the text > hover arrow on file cards', () => {
    const { container } = render(
      <TopicFilesList
        files={[file({})]}
        getFileHref={(code) => `/resources/12biol/1.1/${code.toLowerCase()}`}
      />,
    );

    expect(container.innerHTML).not.toContain("after:content-['>']");
  });
});
