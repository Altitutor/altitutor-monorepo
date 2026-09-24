import React from 'react';
import { render, screen } from '@testing-library/react';
import { TopicFilesList } from '../topic-files-list';
import type { ResourceFile } from '../../lib/types';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock('@altitutor/ui', () => {
  return {
    clickableCardHoverCn: 'hover-card',
    clickableCardFocusWithinCn: 'focus-card',
    ClickableCardIcon: () => <span data-testid="file-icon" />,
    ClickableCardRevealChevron: () => <span data-testid="file-chevron" />,
  };
});

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

function file(overrides: Partial<ResourceFile>): ResourceFile {
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
    ...overrides,
  };
}

describe('TopicFilesList', () => {
  it('renders the solution as its own card next to the primary', () => {
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
          }),
        ]}
        getFileHref={(code) => `/resources/12biol/1.1/${code.toLowerCase()}`}
      />,
    );

    expect(screen.getByText('Solution')).toBeInTheDocument();
    expect(screen.getByText('1.1N.1 · notes')).toBeInTheDocument();
    expect(screen.getByText('1.1N.1S · notes-solutions')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open 1.1N.1 · notes' }),
    ).toHaveAttribute('href', '/resources/12biol/1.1/1.1n.1');
    expect(
      screen.getByRole('link', { name: 'Open 1.1N.1S · notes-solutions' }),
    ).toHaveAttribute('href', '/resources/12biol/1.1/1.1n.1s');
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

  it('strips the file extension from the card label', () => {
    render(
      <TopicFilesList
        files={[file({ filename: 'Year 12 Notes.PDF' })]}
        getFileHref={(code) => `/resources/12biol/1.1/${code.toLowerCase()}`}
      />,
    );

    expect(screen.getByText('1.1N.1 · Year 12 Notes')).toBeInTheDocument();
    expect(screen.queryByText(/Year 12 Notes\.PDF/i)).not.toBeInTheDocument();
  });
});
