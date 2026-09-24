export type TableNode = {
  attrs?: Record<string, unknown>;
  content?: TableNode[];
};
export function tableColumnWidths(
  rows: TableNode[],
  available: number,
): number[] {
  const count = Math.max(
    1,
    ...rows.map((row) =>
      (row.content ?? []).reduce((sum, cell) => sum + columnSpan(cell), 0),
    ),
  );
  // One shared grid for all rows. An unbounded horizontal ScrollView must not
  // let flex size each cell independently from its text content.
  return Array.from({ length: count }, () => Math.max(150, available / count));
}
export function columnSpan(cell: TableNode): number {
  const value = Number(cell.attrs?.colspan ?? 1);
  return Number.isInteger(value) && value > 0 && value <= 30 ? value : 1;
}
