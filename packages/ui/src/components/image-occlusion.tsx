'use client';

import {
  clampImageOcclusionMask,
  getImageOcclusionIndexes,
  getNextImageOcclusionIndex,
  IMAGE_OCCLUSION_MAX_FILE_BYTES,
  IMAGE_OCCLUSION_MAX_MASKS,
  IMAGE_OCCLUSION_MAX_PIXELS,
  IMAGE_OCCLUSION_MIME_TYPES,
  type ImageOcclusionData,
  type ImageOcclusionMask,
} from '@altitutor/shared';
import { CornerDownLeft, Hand, ImagePlus, Minus, MousePointer2, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';

type Point = { x: number; y: number };
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

function maskStyle(mask: ImageOcclusionMask): React.CSSProperties {
  return {
    left: `${mask.x * 100}%`,
    top: `${mask.y * 100}%`,
    width: `${mask.width * 100}%`,
    height: `${mask.height * 100}%`,
  };
}

export function ImageOcclusionViewer({
  imageUrl,
  alt,
  data,
  activeClozeIndex,
  showAnswer,
  onLoad,
  onError,
}: {
  imageUrl: string;
  alt: string;
  data: ImageOcclusionData;
  activeClozeIndex: number;
  showAnswer: boolean;
  onLoad?: () => void;
  onError?: () => void;
}) {
  return (
    <div className="relative mx-auto w-full max-w-full overflow-hidden rounded-lg border bg-muted/20">
      {/* Signed URLs and local object URLs cannot be handled reliably by next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        className="block h-auto w-full select-none"
        draggable={false}
        onLoad={onLoad}
        onError={onError}
      />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {data.masks.map((mask) => {
          const revealed = showAnswer && mask.clozeIndex === activeClozeIndex;
          return (
            <div
              key={mask.id}
              style={maskStyle(mask)}
              className={revealed
                ? 'absolute rounded-sm border-2 border-amber-500 bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.25)]'
                : 'absolute rounded-sm border border-slate-900/60 bg-slate-600 shadow-sm dark:border-slate-100/70 dark:bg-slate-300'}
            />
          );
        })}
      </div>
    </div>
  );
}

function readImageDimensions(file: File): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected file is not a readable image.'));
    };
    image.src = url;
  });
}

function resizeMask(mask: ImageOcclusionMask, handle: ResizeHandle, delta: Point): ImageOcclusionMask {
  let { x, y, width, height } = mask;
  if (handle.includes('w')) {
    x += delta.x;
    width -= delta.x;
  }
  if (handle.includes('e')) width += delta.x;
  if (handle.includes('n')) {
    y += delta.y;
    height -= delta.y;
  }
  if (handle.includes('s')) height += delta.y;
  return clampImageOcclusionMask({ ...mask, x, y, width, height });
}

const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const handlePositions: Record<ResizeHandle, string> = {
  nw: '-left-2 -top-2 cursor-nwse-resize',
  n: 'left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize',
  ne: '-right-2 -top-2 cursor-nesw-resize',
  e: '-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize',
  se: '-bottom-2 -right-2 cursor-nwse-resize',
  s: '-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize',
  sw: '-bottom-2 -left-2 cursor-nesw-resize',
  w: '-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize',
};

export function ImageOcclusionEditor({
  imageUrl,
  imageAltText,
  data,
  onChange,
  onImageAltTextChange,
  onImageSelected,
}: {
  imageUrl: string | null;
  imageAltText: string;
  data: ImageOcclusionData | null;
  onChange: (data: ImageOcclusionData) => void;
  onImageAltTextChange: (value: string) => void;
  onImageSelected: (file: File, dimensions: { naturalWidth: number; naturalHeight: number }) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef(data);
  const dragRef = useRef<{
    kind: 'draw' | 'move' | 'resize' | 'pan';
    start: Point;
    original?: ImageOcclusionMask;
    handle?: ResizeHandle;
    scrollLeft?: number;
    scrollTop?: number;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawingClozeIndex, setDrawingClozeIndex] = useState<number | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<ImageOcclusionData[]>([]);
  const [future, setFuture] = useState<ImageOcclusionData[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);
  const selectedMask = data?.masks.find((mask) => mask.id === selectedId) ?? null;
  const indexes = useMemo(() => getImageOcclusionIndexes(data), [data]);

  const commit = useCallback((next: ImageOcclusionData, record = true) => {
    if (record && dataRef.current) setHistory((items) => [...items.slice(-49), dataRef.current!]);
    if (record) setFuture([]);
    dataRef.current = next;
    onChange(next);
  }, [onChange]);

  const pointFromEvent = useCallback((event: PointerEvent | React.PointerEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }, []);

  const undo = useCallback(() => {
    if (!dataRef.current || history.length === 0) return;
    const previous = history.at(-1)!;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [...items, dataRef.current!]);
    commit(previous, false);
  }, [commit, history]);

  const redo = useCallback(() => {
    if (!dataRef.current || future.length === 0) return;
    const next = future.at(-1)!;
    setFuture((items) => items.slice(0, -1));
    setHistory((items) => [...items, dataRef.current!]);
    commit(next, false);
  }, [commit, future]);

  const deleteSelected = useCallback(() => {
    if (!dataRef.current || !selectedId) return;
    commit({ ...dataRef.current, masks: dataRef.current.masks.filter((mask) => mask.id !== selectedId) });
    setSelectedId(null);
  }, [commit, selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (event.key === 'Escape') {
        setDrawingClozeIndex(null);
        setPanMode(false);
        return;
      }
      if (!selectedMask || !dataRef.current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 0.01 : 0.002;
      const delta = {
        x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
        y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
      };
      const nextMask = clampImageOcclusionMask({ ...selectedMask, x: selectedMask.x + delta.x, y: selectedMask.y + delta.y });
      commit({ ...dataRef.current, masks: dataRef.current.masks.map((mask) => mask.id === selectedId ? nextMask : mask) });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commit, deleteSelected, redo, selectedId, selectedMask, undo]);

  const beginCanvasPointer = (event: React.PointerEvent) => {
    if (!data || !canvasRef.current) return;
    if (panMode) {
      dragRef.current = {
        kind: 'pan',
        start: { x: event.clientX, y: event.clientY },
        scrollLeft: viewportRef.current?.scrollLeft ?? 0,
        scrollTop: viewportRef.current?.scrollTop ?? 0,
      };
      canvasRef.current.setPointerCapture(event.pointerId);
      return;
    }
    if (drawingClozeIndex !== null && data.masks.length < IMAGE_OCCLUSION_MAX_MASKS) {
      dragRef.current = { kind: 'draw', start: pointFromEvent(event) };
      canvasRef.current.setPointerCapture(event.pointerId);
      return;
    }
    setSelectedId(null);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !dataRef.current) return;
    if (drag.kind === 'pan') {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.scrollLeft = (drag.scrollLeft ?? 0) - (event.clientX - drag.start.x);
      viewport.scrollTop = (drag.scrollTop ?? 0) - (event.clientY - drag.start.y);
      return;
    }
    if (!drag.original) return;
    const point = pointFromEvent(event);
    const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
    const nextMask = drag.kind === 'resize' && drag.handle
      ? resizeMask(drag.original, drag.handle, delta)
      : clampImageOcclusionMask({ ...drag.original, x: drag.original.x + delta.x, y: drag.original.y + delta.y });
    commit({ ...dataRef.current, masks: dataRef.current.masks.map((mask) => mask.id === drag.original?.id ? nextMask : mask) }, false);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !dataRef.current) return;
    if (drag.kind === 'draw') {
      const end = pointFromEvent(event);
      const mask = clampImageOcclusionMask({
        id: crypto.randomUUID(),
        clozeIndex: drawingClozeIndex ?? getNextImageOcclusionIndex(dataRef.current),
        x: Math.min(drag.start.x, end.x),
        y: Math.min(drag.start.y, end.y),
        width: Math.abs(end.x - drag.start.x),
        height: Math.abs(end.y - drag.start.y),
      });
      commit({ ...dataRef.current, masks: [...dataRef.current.masks, mask] });
      setSelectedId(mask.id);
      setDrawingClozeIndex(null);
      return;
    }
    if ((drag.kind === 'move' || drag.kind === 'resize') && drag.original) {
      setHistory((items) => [...items.slice(-49), { ...dataRef.current!, masks: dataRef.current!.masks.map((mask) => mask.id === drag.original?.id ? drag.original! : mask) }]);
      setFuture([]);
    }
  };

  const beginMaskPointer = (event: React.PointerEvent, mask: ImageOcclusionMask) => {
    event.stopPropagation();
    if (drawingClozeIndex !== null || panMode) return;
    setSelectedId(mask.id);
    dragRef.current = { kind: 'move', start: pointFromEvent(event), original: mask };
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const beginResize = (event: React.PointerEvent, mask: ImageOcclusionMask, handle: ResizeHandle) => {
    event.stopPropagation();
    dragRef.current = { kind: 'resize', start: pointFromEvent(event), original: mask, handle };
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const chooseImage = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    if (!(IMAGE_OCCLUSION_MIME_TYPES as readonly string[]).includes(file.type)) {
      setFileError('Choose a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > IMAGE_OCCLUSION_MAX_FILE_BYTES) {
      setFileError('The image must be 10 MB or smaller.');
      return;
    }
    try {
      const dimensions = await readImageDimensions(file);
      if (dimensions.naturalWidth * dimensions.naturalHeight > IMAGE_OCCLUSION_MAX_PIXELS) {
        setFileError('The image must be 25 megapixels or smaller.');
        return;
      }
      onImageSelected(file, dimensions);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Unable to read this image.');
    }
  };

  if (!imageUrl || !data) {
    return (
      <div
        className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/20 p-8 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); void chooseImage(event.dataTransfer.files[0]); }}
        onPaste={(event) => void chooseImage([...event.clipboardData.files].find((file) => file.type.startsWith('image/')))}
      >
        <ImagePlus className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Add the image to occlude</p>
          <p className="text-sm text-muted-foreground">Choose, drop, or paste a PNG, JPEG, or WebP image.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>Choose image</Button>
        <input ref={fileInputRef} type="file" className="sr-only" accept={IMAGE_OCCLUSION_MIME_TYPES.join(',')} onChange={(event) => void chooseImage(event.target.files?.[0])} />
        {fileError ? <p role="alert" className="text-sm text-destructive">{fileError}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={drawingClozeIndex !== null && !panMode ? 'default' : 'outline'} onClick={() => { setPanMode(false); setDrawingClozeIndex(getNextImageOcclusionIndex(data)); }}>
          <Plus className="mr-1.5 h-4 w-4" />New box
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!selectedMask} onClick={() => { setPanMode(false); setDrawingClozeIndex(selectedMask?.clozeIndex ?? null); }}>
          <CornerDownLeft className="mr-1.5 h-4 w-4" />Same cloze
        </Button>
        <Button type="button" size="sm" variant={panMode ? 'default' : 'outline'} onClick={() => { setPanMode((value) => !value); setDrawingClozeIndex(null); }}>
          {panMode ? <Hand className="mr-1.5 h-4 w-4" /> : <MousePointer2 className="mr-1.5 h-4 w-4" />}Pan
        </Button>
        <Button type="button" size="icon" variant="outline" aria-label="Undo" disabled={history.length === 0} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="outline" aria-label="Redo" disabled={future.length === 0} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" size="icon" variant="outline" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}><Minus className="h-4 w-4" /></Button>
          <span className="w-14 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button type="button" size="icon" variant="outline" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(3, value + 0.25))}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <div ref={viewportRef} className="max-h-[60vh] overflow-auto rounded-xl border bg-muted/30 p-3">
        <div
          ref={canvasRef}
          className={panMode ? 'relative mx-auto cursor-grab touch-none select-none' : drawingClozeIndex !== null ? 'relative mx-auto cursor-crosshair touch-none select-none' : 'relative mx-auto touch-none select-none'}
          style={{ width: `${zoom * 100}%` }}
          onPointerDown={beginCanvasPointer}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={imageAltText} className="block h-auto w-full" draggable={false} />
          <div className="absolute inset-0">
            {data.masks.map((mask) => {
              const selected = mask.id === selectedId;
              return (
                <button
                  type="button"
                  key={mask.id}
                  aria-label={`Cloze ${mask.clozeIndex} box`}
                  className={selected
                    ? 'absolute rounded-sm border-2 border-primary bg-primary/45 ring-2 ring-background'
                    : 'absolute rounded-sm border border-slate-900/70 bg-slate-600/75 hover:bg-slate-600/60'}
                  style={maskStyle(mask)}
                  onPointerDown={(event) => beginMaskPointer(event, mask)}
                >
                  <span className="absolute left-1 top-1 rounded bg-background/95 px-1.5 py-0.5 text-xs font-bold text-foreground shadow">{mask.clozeIndex}</span>
                  {selected ? handles.map((handle) => (
                    <span
                      key={handle}
                      role="presentation"
                      className={`absolute h-4 w-4 rounded-full border-2 border-primary bg-background ${handlePositions[handle]}`}
                      onPointerDown={(event) => beginResize(event, mask, handle)}
                    />
                  )) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="image-occlusion-alt">Image alt text</Label>
          <Input id="image-occlusion-alt" value={imageAltText} onChange={(event) => onImageAltTextChange(event.target.value)} placeholder="Optional description of the diagram" />
        </div>
        {selectedMask ? (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="image-occlusion-index">Selected cloze number</Label>
                <Input
                  id="image-occlusion-index"
                  type="number"
                  min={1}
                  value={selectedMask.clozeIndex}
                  onChange={(event) => {
                    const clozeIndex = Math.max(1, Math.trunc(Number(event.target.value) || 1));
                    commit({ ...data, masks: data.masks.map((mask) => mask.id === selectedMask.id ? { ...mask, clozeIndex } : mask) });
                  }}
                />
              </div>
              <Button type="button" size="icon" variant="destructive" aria-label="Delete selected box" onClick={deleteSelected}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image-occlusion-description">Cloze {selectedMask.clozeIndex} answer description</Label>
              <Textarea
                id="image-occlusion-description"
                value={data.groupDescriptions?.[String(selectedMask.clozeIndex)] ?? ''}
                onChange={(event) => commit({
                  ...data,
                  groupDescriptions: { ...data.groupDescriptions, [String(selectedMask.clozeIndex)]: event.target.value },
                })}
                placeholder="Optional text shown after revealing this group"
                rows={2}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center text-sm text-muted-foreground">Select a box to edit its cloze number or description.</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{data.masks.length}/100 boxes · {indexes.length} cloze{indexes.length === 1 ? '' : 's'}</p>
    </div>
  );
}
