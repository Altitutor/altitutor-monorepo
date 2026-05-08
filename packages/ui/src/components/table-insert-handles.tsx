'use client';

import * as React from 'react';
import type { Editor } from '@tiptap/core';
import { Plus } from 'lucide-react';

import { cn } from '../lib/cn';

const EDGE_HIT_PX = 10;
/** Distance outside the table left edge for the row + control */
const ROW_GUTTER = 22;
/** Include floating + button area left of the gutter line */
const ROW_HITZONE_LEFT = 44;
/** Distance above the table for the column + control */
const COL_GUTTER = 22;
/** Include floating + above header row */
const COL_HITZONE_TOP = 40;

function getAnchorPos(editor: Editor, table: HTMLTableElement, row: number, col: number): number | null {
  const tr = table.rows[row];
  const cell = tr?.cells[Math.min(col, tr.cells.length - 1)];
  if (!cell) return null;
  try {
    const pos = editor.view.posAtDOM(cell, 0);
    if (typeof pos === 'number' && pos >= 0) return pos;
  } catch {
    /* empty */
  }
  const inner = cell.querySelector('p, h1, h2, h3, h4, h5, h6, div');
  if (inner) {
    try {
      const pos = editor.view.posAtDOM(inner, 0);
      if (typeof pos === 'number' && pos >= 0) return pos;
    } catch {
      /* empty */
    }
  }
  return null;
}

interface HitRow {
  table: HTMLTableElement;
  y: number;
  insertAfterRow: number;
}

interface HitCol {
  table: HTMLTableElement;
  x: number;
  insertAfterCol: number;
}

function pickTables(editor: Editor): HTMLTableElement[] {
  return Array.from(editor.view.dom.querySelectorAll('table'));
}

function findRowHit(editor: Editor, clientX: number, clientY: number): HitRow | null {
  let best: { dist: number; hit: HitRow } | null = null;

  for (const table of pickTables(editor)) {
    const trs = Array.from(table.rows);
    if (trs.length === 0) continue;

    const rect = table.getBoundingClientRect();
    if (clientX < rect.left - ROW_HITZONE_LEFT || clientX > rect.left + 12) continue;
    if (clientY < rect.top - 24 || clientY > rect.bottom + 24) continue;

    const candidates: { y: number; insertAfterRow: number }[] = [];

    candidates.push({
      y: (rect.top + trs[0].getBoundingClientRect().top) / 2,
      insertAfterRow: -1,
    });

    for (let i = 0; i < trs.length - 1; i++) {
      const a = trs[i].getBoundingClientRect().bottom;
      const b = trs[i + 1].getBoundingClientRect().top;
      candidates.push({ y: (a + b) / 2, insertAfterRow: i });
    }

    candidates.push({
      y: (trs[trs.length - 1].getBoundingClientRect().bottom + rect.bottom) / 2,
      insertAfterRow: trs.length - 1,
    });

    for (const c of candidates) {
      const d = Math.abs(clientY - c.y);
      if (d <= EDGE_HIT_PX + 6) {
        const hit: HitRow = { table, y: c.y, insertAfterRow: c.insertAfterRow };
        if (!best || d < best.dist) best = { dist: d, hit };
      }
    }
  }

  return best?.hit ?? null;
}

function findColHit(editor: Editor, clientX: number, clientY: number): HitCol | null {
  let best: { dist: number; hit: HitCol } | null = null;

  for (const table of pickTables(editor)) {
    const firstRow = table.rows[0];
    if (!firstRow) continue;
    const cells = Array.from(firstRow.cells);
    if (cells.length === 0) continue;

    const rect = table.getBoundingClientRect();
    if (clientY < rect.top - COL_HITZONE_TOP || clientY > rect.top + 16) continue;
    if (clientX < rect.left - 28 || clientX > rect.right + 28) continue;

    const candidates: { x: number; insertAfterCol: number }[] = [];

    candidates.push({
      x: (rect.left + cells[0].getBoundingClientRect().left) / 2,
      insertAfterCol: -1,
    });

    for (let j = 0; j < cells.length - 1; j++) {
      const a = cells[j].getBoundingClientRect().right;
      const b = cells[j + 1].getBoundingClientRect().left;
      candidates.push({ x: (a + b) / 2, insertAfterCol: j });
    }

    candidates.push({
      x: (cells[cells.length - 1].getBoundingClientRect().right + rect.right) / 2,
      insertAfterCol: cells.length - 1,
    });

    for (const c of candidates) {
      const d = Math.abs(clientX - c.x);
      if (d <= EDGE_HIT_PX + 6) {
        const hit: HitCol = { table, x: c.x, insertAfterCol: c.insertAfterCol };
        if (!best || d < best.dist) best = { dist: d, hit };
      }
    }
  }

  return best?.hit ?? null;
}

export interface TableInsertHandlesProps {
  editor: Editor | null;
  editable: boolean;
}

/**
 * Google-docs-style + controls: row insertion along the left gutter, column insertion along the top edge.
 */
export function TableInsertHandles({ editor, editable }: TableInsertHandlesProps) {
  const [rowHit, setRowHit] = React.useState<HitRow | null>(null);
  const [colHit, setColHit] = React.useState<HitCol | null>(null);
  const [, setTick] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);
  const pendingRef = React.useRef<{ x: number; y: number } | null>(null);
  const lastMouseRef = React.useRef<{ x: number; y: number } | null>(null);

  const applyHits = React.useCallback(() => {
    const p = pendingRef.current ?? lastMouseRef.current;
    pendingRef.current = null;
    if (!p || !editor || editor.isDestroyed) {
      setRowHit(null);
      setColHit(null);
      return;
    }
    setRowHit(findRowHit(editor, p.x, p.y));
    setColHit(findColHit(editor, p.x, p.y));
    setTick((t) => t + 1);
  }, [editor]);

  React.useEffect(() => {
    if (!editor || editor.isDestroyed || !editable) {
      setRowHit(null);
      setColHit(null);
      return;
    }

    const dom = editor.view.dom;

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        applyHits();
      });
    };

    const pointerRelevant = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-table-insert-handle]')) return true;
      const rect = dom.getBoundingClientRect();
      return (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
    };

    const onDocMove = (e: MouseEvent) => {
      if (!pointerRelevant(e)) {
        lastMouseRef.current = null;
        pendingRef.current = null;
        setRowHit(null);
        setColHit(null);
        return;
      }
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      pendingRef.current = { x: e.clientX, y: e.clientY };
      schedule();
    };

    const onScroll = () => {
      if (lastMouseRef.current) {
        pendingRef.current = lastMouseRef.current;
        schedule();
      }
    };

    document.addEventListener('mousemove', onDocMove, { passive: true });
    window.addEventListener('scroll', onScroll, true);

    return () => {
      document.removeEventListener('mousemove', onDocMove);
      window.removeEventListener('scroll', onScroll, true);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [editor, editable, applyHits]);

  const runRowInsert = React.useCallback(
    (hit: HitRow) => {
      if (!editor || editor.isDestroyed) return;
      const table = hit.table;
      const rows = table.rows;
      if (rows.length === 0) return;

      if (hit.insertAfterRow === -1) {
        const pos = getAnchorPos(editor, table, 0, 0);
        if (pos == null) return;
        editor.chain().focus().setTextSelection(pos).addRowBefore().run();
        return;
      }

      const anchorRow = Math.min(hit.insertAfterRow, rows.length - 1);
      const pos = getAnchorPos(editor, table, anchorRow, 0);
      if (pos == null) return;
      editor.chain().focus().setTextSelection(pos).addRowAfter().run();
    },
    [editor]
  );

  const runColInsert = React.useCallback(
    (hit: HitCol) => {
      if (!editor || editor.isDestroyed) return;
      const table = hit.table;
      const firstRow = table.rows[0];
      if (!firstRow || firstRow.cells.length === 0) return;

      if (hit.insertAfterCol === -1) {
        const pos = getAnchorPos(editor, table, 0, 0);
        if (pos == null) return;
        editor.chain().focus().setTextSelection(pos).addColumnBefore().run();
        return;
      }

      const anchorCol = Math.min(hit.insertAfterCol, firstRow.cells.length - 1);
      const pos = getAnchorPos(editor, table, 0, anchorCol);
      if (pos == null) return;
      editor.chain().focus().setTextSelection(pos).addColumnAfter().run();
    },
    [editor]
  );

  if (!editable || !editor || editor.isDestroyed) {
    return null;
  }

  return (
    <>
      {rowHit && (
        <button
          type="button"
          tabIndex={-1}
          data-table-insert-handle=""
          aria-label="Insert row"
          className={cn(
            'fixed z-[120] flex h-5 w-5 items-center justify-center rounded-full border border-border',
            'bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground',
            'pointer-events-auto transition-colors'
          )}
          style={{
            left: rowHit.table.getBoundingClientRect().left - ROW_GUTTER,
            top: rowHit.y - 10,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            runRowInsert(rowHit);
          }}
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
        </button>
      )}
      {colHit && (
        <button
          type="button"
          tabIndex={-1}
          data-table-insert-handle=""
          aria-label="Insert column"
          className={cn(
            'fixed z-[120] flex h-5 w-5 items-center justify-center rounded-full border border-border',
            'bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground',
            'pointer-events-auto transition-colors'
          )}
          style={{
            left: colHit.x - 10,
            top: colHit.table.getBoundingClientRect().top - COL_GUTTER,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            runColInsert(colHit);
          }}
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
        </button>
      )}
    </>
  );
}
