import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ImageOcclusionData } from '@altitutor/shared';
import { ImageOcclusionViewer } from '../image-occlusion';

const data: ImageOcclusionData = {
  version: 1,
  naturalWidth: 1000,
  naturalHeight: 800,
  masks: [
    { id: 'one-a', clozeIndex: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    { id: 'one-b', clozeIndex: 1, x: 0.4, y: 0.1, width: 0.2, height: 0.2 },
    { id: 'two', clozeIndex: 2, x: 0.1, y: 0.5, width: 0.2, height: 0.2 },
  ],
};

describe('ImageOcclusionViewer', () => {
  it('masks every group on the question', () => {
    const html = renderToStaticMarkup(
      <ImageOcclusionViewer imageUrl="/diagram.png" alt="Diagram" data={data} activeClozeIndex={1} showAnswer={false} />,
    );
    expect(html.match(/bg-slate-600/g)).toHaveLength(3);
    expect(html).not.toContain('border-amber-500');
  });

  it('reveals every box in the active group while keeping other groups masked', () => {
    const html = renderToStaticMarkup(
      <ImageOcclusionViewer imageUrl="/diagram.png" alt="Diagram" data={data} activeClozeIndex={1} showAnswer />,
    );
    expect(html.match(/border-amber-500/g)).toHaveLength(2);
    expect(html.match(/bg-slate-600/g)).toHaveLength(1);
  });
});
