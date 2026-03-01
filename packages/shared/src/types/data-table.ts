export interface DataTableFilterOption<TValue = unknown> {
  label: string;
  value: TValue;
}

export interface DataTableFilterDefinition<TValue = unknown> {
  key: string;
  label: string;
  options?: DataTableFilterOption<TValue>[];
  type?: 'multi-select' | 'date' | 'number-range';
  /** When type is 'number-range', state keys for min and max values */
  minKey?: string;
  maxKey?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterable?: boolean;
}

export interface DataTableSortOption {
  key: string;
  label: string;
}

export interface DataTableGroupByOption {
  key: string;
  label: string;
}

export interface DataTableColumnDefinition {
  key: string;
  label: string;
  visibleByDefault?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
}

export interface DataTableState {
  search: string;
  filters: Record<string, unknown[]>;
  sortBy: string | null;
  sortDirection: 'asc' | 'desc';
  groupBy: string | null;
  page: number;
  pageSize: number;
  visibleColumns: string[];
}
