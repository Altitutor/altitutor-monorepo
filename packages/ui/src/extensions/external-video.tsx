'use client';

import { Node, mergeAttributes, type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

type ExternalVideoAttrs = {
  src?: string | null;
  embedUrl?: string | null;
  provider?: string | null;
  title?: string | null;
};

function providerLabel(provider: string | null | undefined): string {
  if (provider === 'youtube') return 'YouTube';
  if (provider === 'vimeo') return 'Vimeo';
  return 'External';
}

function ExternalVideoView({ node, selected }: NodeViewProps) {
  const attrs = node.attrs as ExternalVideoAttrs;
  const embedUrl = typeof attrs.embedUrl === 'string' ? attrs.embedUrl : '';
  const src = typeof attrs.src === 'string' ? attrs.src : '';
  const provider = typeof attrs.provider === 'string' ? attrs.provider : null;
  const title =
    typeof attrs.title === 'string' && attrs.title.trim()
      ? attrs.title.trim()
      : `${providerLabel(provider)} video`;

  return (
    <NodeViewWrapper
      as="figure"
      data-external-video
      className={[
        'my-4 overflow-hidden rounded-md border border-border bg-card shadow-sm not-prose',
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      contentEditable={false}
    >
      {embedUrl ? (
        <div className="aspect-video w-full bg-muted">
          <iframe
            src={embedUrl}
            title={title}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
      ) : (
        <div className="flex min-h-28 items-center justify-center px-4 py-6 text-center text-sm text-muted-foreground">
          Unsupported video embed.
        </div>
      )}
      {src ? (
        <figcaption className="border-t border-border bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="break-all text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {src}
          </a>
        </figcaption>
      ) : null}
    </NodeViewWrapper>
  );
}

export const ExternalVideoExtension = Node.create({
  name: 'externalVideo',

  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-src'),
        renderHTML: (attributes) =>
          attributes.src ? { 'data-src': attributes.src } : {},
      },
      embedUrl: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-embed-url'),
        renderHTML: (attributes) =>
          attributes.embedUrl ? { 'data-embed-url': attributes.embedUrl } : {},
      },
      provider: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-provider'),
        renderHTML: (attributes) =>
          attributes.provider ? { 'data-provider': attributes.provider } : {},
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) =>
          attributes.title ? { 'data-title': attributes.title } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-external-video]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as ExternalVideoAttrs;
    const title =
      typeof attrs.title === 'string' && attrs.title.trim()
        ? attrs.title.trim()
        : `${providerLabel(attrs.provider)} video`;

    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-external-video': '',
        class: 'external-video',
      }),
      [
        'div',
        { class: 'external-video__frame' },
        attrs.embedUrl
          ? [
              'iframe',
              {
                src: attrs.embedUrl,
                title,
                loading: 'lazy',
                allow:
                  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                allowfullscreen: 'true',
                referrerpolicy: 'strict-origin-when-cross-origin',
                sandbox: 'allow-scripts allow-same-origin allow-presentation',
              },
            ]
          : ['span', {}, 'Unsupported video embed.'],
      ],
      attrs.src
        ? [
            'figcaption',
            {},
            ['a', { href: attrs.src, target: '_blank', rel: 'noreferrer' }, attrs.src],
          ]
        : ['figcaption', {}, ''],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ExternalVideoView);
  },
});
