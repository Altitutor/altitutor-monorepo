/** @jest-environment jsdom */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  KanbanBoard,
  KANBAN_COLUMN_VIRTUALIZE_AFTER,
  type KanbanColumnDef,
} from '../kanban-board';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DragOverlay: ({ children }: React.PropsWithChildren) => <>{children}</>,
  PointerSensor: function PointerSensor() {},
  closestCorners: jest.fn(),
  useDroppable: () => ({ setNodeRef: jest.fn(), isOver: false }),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: React.PropsWithChildren) => <>{children}</>,
  verticalListSortingStrategy: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => undefined } },
}));

jest.mock('../scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('../searchable-select-inline', () => ({
  SearchableSelectInline: () => null,
}));

jest.mock('../date-range-filter', () => ({ DateRangeFilter: () => null }));
jest.mock('../toolbar-active-badge', () => ({ ToolbarActiveBadge: () => null }));

jest.mock('../dropdown-menu', () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuContent: () => null,
  DropdownMenuItem: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuLabel: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuSeparator: () => null,
  DropdownMenuSub: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuSubContent: () => null,
  DropdownMenuSubTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

type Item = { id: string; status: 'todo' | 'done' };

const columns: KanbanColumnDef<Item, unknown>[] = [
  {
    key: 'status',
    label: 'Status',
    getValue: (item) => item.status,
    options: [
      { value: 'todo', label: 'Todo' },
      { value: 'done', label: 'Done' },
    ],
    onValueChange: jest.fn(),
  },
];

describe('KanbanBoard column windowing', () => {
  it('does not mount every card in a large unmeasured column', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const items: Item[] = Array.from(
      { length: KANBAN_COLUMN_VIRTUALIZE_AFTER + 40 },
      (_, index) => ({ id: `item-${index}`, status: 'todo' as const }),
    );

    act(() => {
      root.render(
        <KanbanBoard<Item>
          items={items}
          getItemId={(item) => item.id}
          columnDefs={columns}
          activeColumnKey="status"
          renderCard={(item) => <div data-card-id={item.id}>{item.id}</div>}
          rightPills={[]}
        />,
      );
    });

    const mounted = container.querySelectorAll('[data-card-id]').length;
    expect(mounted).toBe(KANBAN_COLUMN_VIRTUALIZE_AFTER);
    expect(container.querySelector('[data-card-id="item-0"]')).not.toBeNull();
    expect(
      container.querySelector(`[data-card-id="item-${KANBAN_COLUMN_VIRTUALIZE_AFTER}"]`),
    ).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
