import type { CalendarDay } from "./month-calendar";

export const CELL_GAP = 4;

export type CalendarGrid = {
  x: number;
  y: number;
  cell: number;
  days: (CalendarDay | null)[];
};

export function hitDay(
  grid: CalendarGrid,
  pageX: number,
  pageY: number,
  today: string,
): { day: CalendarDay; index: number } | null {
  const stride = grid.cell + CELL_GAP;
  const col = Math.floor((pageX - grid.x) / stride);
  const row = Math.floor((pageY - grid.y) / stride);
  if (col < 0 || col > 6 || row < 0 || row > 5) return null;
  if (pageX - grid.x - col * stride > grid.cell) return null;
  if (pageY - grid.y - row * stride > grid.cell) return null;
  const index = row * 7 + col;
  const day = grid.days[index];
  if (!day || day.dateKey > today) return null;
  return { day, index };
}
