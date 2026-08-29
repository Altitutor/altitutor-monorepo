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

function occlusionRoles(html: string): string[] {
  return [...html.matchAll(/data-occlusion-role="([^"]+)"/g)].map((match) => match[1]);
}

describe('ImageOcclusionViewer', () => {
  it('highlights the active group on the question while keeping every box covered', () => {
    const html = renderToStaticMarkup(
      <ImageOcclusionViewer imageUrl="/diagram.png" alt="Diagram" data={data} activeClozeIndex={1} showAnswer={false} />,
    );
    expect(occlusionRoles(html)).toEqual(['prompt', 'prompt', 'other']);
  });

  it('reveals every box in the active group while keeping other groups masked', () => {
    const html = renderToStaticMarkup(
      <ImageOcclusionViewer imageUrl="/diagram.png" alt="Diagram" data={data} activeClozeIndex={1} showAnswer />,
    );
    expect(occlusionRoles(html)).toEqual(['answer', 'answer', 'other']);
  });
});
