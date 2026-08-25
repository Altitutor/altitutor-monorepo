/** @jest-environment jsdom */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { KanbanBoard, type KanbanColumnDef } from '../kanban-board';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type DragCallbacks = {
  onDragStart?: (event: { active: { id: string } }) => void;
  onDragOver?: (event: {
    active: { id: string; rect: { current: { translated: null } } };
    activatorEvent: { clientY: number };
    delta: { y: number };
    over: { id: string; rect: { top: number; height: number } };
  }) => void;
  onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void;
  collisionDetection?: (args: Record<string, unknown>) => Array<{ id: string }>;
};

let dragCallbacks: DragCallbacks = {};
let simulateMeasurementFeedback = false;
let dragOverlayDropAnimation: unknown = 'not-rendered';
let sortableOptionsById = new Map<
  string,
  { animateLayoutChanges?: (args: Record<string, unknown>) => boolean }
>();
let mockClosestCornersResult: Array<{ id: string }> = [];
let mockPointerWithinResult: Array<{ id: string }> = [];

jest.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragOver,
    onDragEnd,
    collisionDetection,
  }: React.PropsWithChildren<DragCallbacks>) => {
    dragCallbacks = { onDragStart, onDragOver, onDragEnd, collisionDetection };

    React.useLayoutEffect(() => {
      if (!simulateMeasurementFeedback) return;

      const cardIds = Array.from(document.querySelectorAll('[data-card-id]')).map((element) =>
        element.getAttribute('data-card-id'),
      );
      const activeIsBeforeTarget = cardIds.indexOf('b') < cardIds.indexOf('d');
      onDragOver?.({
        active: {
          id: 'b',
          rect: {
            current: {
              translated: { top: activeIsBeforeTarget ? 300 : 0 } as never,
            },
          },
        },
        activatorEvent: { clientY: 220 },
        delta: { y: 0 },
        over: { id: 'd', rect: { top: 200, height: 80 } },
      });
    });

    return <>{children}</>;
  },
  DragOverlay: ({
    children,
    dropAnimation,
  }: React.PropsWithChildren<{ dropAnimation?: unknown }>) => {
    dragOverlayDropAnimation = dropAnimation;
    return <>{children}</>;
  },
  PointerSensor: function PointerSensor() {},
  closestCorners: jest.fn(() => mockClosestCornersResult),
  pointerWithin: jest.fn(() => mockPointerWithinResult),
  useDroppable: () => ({ setNodeRef: jest.fn(), isOver: false }),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: React.PropsWithChildren) => <>{children}</>,
  verticalListSortingStrategy: jest.fn(),
  useSortable: (options: {
    id: string;
    animateLayoutChanges?: (args: Record<string, unknown>) => boolean;
  }) => {
    sortableOptionsById.set(options.id, options);
    return {
      attributes: {},
      listeners: {},
      setNodeRef: jest.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
    };
  },
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

const items: Item[] = [
  { id: 'a', status: 'todo' },
  { id: 'b', status: 'todo' },
  { id: 'c', status: 'done' },
  { id: 'd', status: 'done' },
];

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

describe('KanbanBoard cross-column drag preview', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    dragCallbacks = {};
    simulateMeasurementFeedback = false;
    dragOverlayDropAnimation = 'not-rendered';
    sortableOptionsById = new Map();
    mockClosestCornersResult = [];
    mockPointerWithinResult = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('inserts the dragged card at the hovered position in another column before drop', () => {
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

    act(() => {
      dragCallbacks.onDragStart?.({ active: { id: 'b' } });
      dragCallbacks.onDragOver?.({
        active: { id: 'b', rect: { current: { translated: null } } },
        activatorEvent: { clientY: 220 },
        delta: { y: 0 },
        over: { id: 'd', rect: { top: 200, height: 80 } },
      });
    });

    const visibleCardIds = Array.from(container.querySelectorAll('[data-card-id]'))
      .map((element) => element.getAttribute('data-card-id'))
      // The drag overlay renders a second copy of the active card.
      .filter((id, index, all) => all.indexOf(id) === index);

    expect(visibleCardIds).toEqual(['a', 'c', 'b', 'd']);

    act(() => {
      dragCallbacks.onDragOver?.({
        active: { id: 'b', rect: { current: { translated: null } } },
        activatorEvent: { clientY: 220 },
        delta: { y: 0 },
        over: { id: 'b', rect: { top: 200, height: 80 } },
      });
    });

    const cardIdsAfterSelfCollision = Array.from(
      container.querySelectorAll('[data-card-id]'),
    )
      .map((element) => element.getAttribute('data-card-id'))
      .filter((id, index, all) => all.indexOf(id) === index);

    expect(cardIdsAfterSelfCollision).toEqual(['a', 'c', 'b', 'd']);
  });

  it('settles when dnd-kit remeasures the target after projecting the card', () => {
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

    simulateMeasurementFeedback = true;

    expect(() => {
      act(() => {
        dragCallbacks.onDragStart?.({ active: { id: 'b' } });
      });
    }).not.toThrow();
  });

  it('does not animate the drag overlay back to its original column on drop', () => {
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

    expect(dragOverlayDropAnimation).toBeNull();
  });

  it('holds the dropped layout until the destination update arrives', async () => {
    const renderBoard = (boardItems: Item[]) => {
      root.render(
        <KanbanBoard<Item>
          items={boardItems}
          getItemId={(item) => item.id}
          columnDefs={columns}
          activeColumnKey="status"
          renderCard={(item) => <div data-card-id={item.id}>{item.id}</div>}
          rightPills={[]}
        />,
      );
    };
    const visibleCardIds = () =>
      Array.from(container.querySelectorAll('[data-card-id]'))
        .map((element) => element.getAttribute('data-card-id'))
        .filter((id, index, all) => all.indexOf(id) === index);

    act(() => renderBoard(items));
    act(() => {
      dragCallbacks.onDragStart?.({ active: { id: 'b' } });
      dragCallbacks.onDragOver?.({
        active: { id: 'b', rect: { current: { translated: null } } },
        activatorEvent: { clientY: 220 },
        delta: { y: 0 },
        over: { id: 'd', rect: { top: 200, height: 80 } },
      });
    });

    expect(visibleCardIds()).toEqual(['a', 'c', 'b', 'd']);

    act(() => {
      dragCallbacks.onDragEnd?.({ active: { id: 'b' }, over: { id: 'd' } });
    });

    // The old props still place B in Todo. Rendering that state would cause the
    // one-frame flash in the source column while the optimistic mutation starts.
    expect(visibleCardIds()).toEqual(['a', 'c', 'b', 'd']);

    act(() => {
      renderBoard(items.map((item) => (item.id === 'b' ? { ...item, status: 'done' } : item)));
    });

    // Preserve the exact dropped layout for the handoff; the following frame
    // can then animate from this order to the configured sorted order.
    expect(visibleCardIds()).toEqual(['a', 'c', 'b', 'd']);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });

    expect(visibleCardIds()).toEqual(['a', 'b', 'c', 'd']);

    const destinationCardOptions = sortableOptionsById.get('c');
    expect(destinationCardOptions?.animateLayoutChanges).toEqual(expect.any(Function));
    expect(
      destinationCardOptions?.animateLayoutChanges?.({
        isSorting: false,
        wasDragging: true,
        items: ['b', 'c', 'd'],
        previousItems: ['c', 'b', 'd'],
      }),
    ).toBe(true);
  });

  it('selects an empty column under the pointer even when corner proximity prefers a source card', () => {
    const itemsWithEmptyDoneColumn = items.filter((item) => item.status === 'todo');

    act(() => {
      root.render(
        <KanbanBoard<Item>
          items={itemsWithEmptyDoneColumn}
          getItemId={(item) => item.id}
          columnDefs={columns}
          activeColumnKey="status"
          renderCard={(item) => <div data-card-id={item.id}>{item.id}</div>}
          rightPills={[]}
        />,
      );
    });

    mockPointerWithinResult = [{ id: 'column-done' }];
    mockClosestCornersResult = [{ id: 'a' }];

    const collisions = dragCallbacks.collisionDetection?.({});

    expect(collisions?.[0]?.id).toBe('column-done');

    act(() => {
      dragCallbacks.onDragStart?.({ active: { id: 'b' } });
      dragCallbacks.onDragOver?.({
        active: { id: 'b', rect: { current: { translated: null } } },
        activatorEvent: { clientY: 220 },
        delta: { y: 0 },
        over: { id: collisions?.[0]?.id ?? '', rect: { top: 100, height: 400 } },
      });
    });

    const doneHeading = Array.from(container.querySelectorAll('h3')).find(
      (heading) => heading.textContent === 'Done',
    );
    const doneColumn = doneHeading?.parentElement?.parentElement?.parentElement;

    expect(doneColumn?.querySelector('[data-card-id="b"]')).not.toBeNull();
  });
});
