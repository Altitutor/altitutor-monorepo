'use client';

import { useEffect, useRef, useState } from 'react';

type Pdfjs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: {
    url: string;
    withCredentials?: boolean;
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
    wasmUrl?: string;
  }) => { promise: Promise<PdfDocument> };
};

type PdfDocument = {
  numPages: number;
  destroy: () => Promise<void>;
  getPage: (pageNumber: number) => Promise<PdfPage>;
};

type PdfViewport = { width: number; height: number };

type PdfPage = {
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => { promise: Promise<void> };
};

let pdfjsLoad: Promise<Pdfjs> | null = null;

function importPublicEsm(href: string): Promise<unknown> {
  // Next webpack wraps pdfjs-dist 5 ESM and throws
  // `Object.defineProperty called on non-object`. A Function-built import()
  // is invisible to the bundler and loads `/pdfjs` as a native module.
  // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval -- hide from webpack
  const importer = new Function('href', 'return import(href)') as (
    url: string,
  ) => Promise<unknown>;
  return importer(href);
}

function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsLoad) {
    pdfjsLoad = importPublicEsm('/pdfjs/pdf.min.mjs').then((mod) => {
      const pdfjs = mod as Pdfjs;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfjsLoad;
}

export function ResourcePdfPages({
  url,
  filename,
  className,
}: {
  url: string;
  filename: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const root = rootRef.current;
    const pages = pagesRef.current;
    if (!root || !pages) return undefined;

    let cancelled = false;
    let doc: PdfDocument | null = null;
    setStatus('loading');
    pages.replaceChildren();

    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        doc = await pdfjs.getDocument({
          url,
          withCredentials: false,
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdfjs/standard_fonts/',
          wasmUrl: '/pdfjs/wasm/',
        }).promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }

        const targetWidth = Math.max(root.clientWidth, 320);
        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
          const page = await doc.getPage(pageNumber);
          if (cancelled) return;
          const unscaled = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: targetWidth / unscaled.width });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'block w-full bg-white';
          const canvasContext = canvas.getContext('2d');
          if (!canvasContext) continue;
          await page.render({
            canvas,
            canvasContext,
            viewport,
          }).promise;
          if (cancelled) return;
          pages.appendChild(canvas);
        }
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      pages.replaceChildren();
      if (doc) void doc.destroy();
    };
  }, [url]);

  return (
    <div
      ref={rootRef}
      data-pdf-preview="paginated"
      className={['overflow-auto rounded-md border bg-muted/30', className].filter(Boolean).join(' ')}
      aria-label={filename}
    >
      {status === 'loading' ? (
        <p className="p-4 text-sm text-muted-foreground">Loading PDF…</p>
      ) : null}
      {status === 'error' ? (
        <p className="p-4 text-sm text-destructive">Couldn’t load this PDF.</p>
      ) : null}
      <div ref={pagesRef} className="w-full" />
    </div>
  );
}
