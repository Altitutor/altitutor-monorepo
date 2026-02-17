'use client';

import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
  ScrollArea,
} from '@altitutor/ui';
import { User, Check, Circle, Clock, Eye, CheckCircle, AlertCircle, AlertTriangle, Info, Gauge, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/utils';
import {
  getPriorityLabel,
  getPriorityIconColor,
  getEstimateLabel,
  getUserInitials,
  ESTIMATE_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../utils/taskUtils';
import type { TaskWithAssignee, TaskPriority } from '../../types';

export function TaskAssigneeEntityPill({
  task,
  staffList,
  onChange,
  collapsed,
}: {
  task: TaskWithAssignee;
  staffList: { id: string; first_name: string | null; last_name: string | null }[];
  onChange: (staffId: string | null) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const assignee = task.assignee;
  const initials = assignee ? getUserInitials(assignee.first_name, assignee.last_name) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-8 border rounded-full group transition-colors bg-background',
            collapsed ? 'px-2 w-auto' : 'px-3 text-xs'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {assignee ? (
            <>
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-medium flex-shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <span className="truncate max-w-[80px]">
                  {assignee.first_name} {assignee.last_name}
                </span>
              )}
            </>
          ) : (
            <>
              <User className={cn("h-3 w-3 text-muted-foreground", !assignee && "opacity-40 group-hover:opacity-100")} />
              {!collapsed && (
                <span className="text-muted-foreground opacity-40 group-hover:opacity-100">Assign</span>
              )}
            </>
          )}
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground opacity-40 group-hover:opacity-100", !assignee && "opacity-40")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="p-2">
          <Input
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 mb-2"
          />
          <ScrollArea className="h-[200px]">
            <div className="space-y-0.5 pr-2">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {!assignee && <Check className="h-4 w-4" />}
                <span>Unassigned</span>
              </button>
              {staffList
                .filter(
                  (s) =>
                    !search.trim() ||
                    `${s.first_name ?? ''} ${s.last_name ?? ''}`.toLowerCase().includes(search.toLowerCase())
                )
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                    }}
                  >
                    {assignee?.id === s.id && <Check className="h-4 w-4" />}
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs flex-shrink-0">
                      {getUserInitials(s.first_name, s.last_name)}
                    </div>
                    <span className="truncate">
                      {s.first_name} {s.last_name}
                    </span>
                  </button>
                ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TaskPriorityEntityPill({
  value,
  onChange,
  collapsed,
}: {
  value: TaskPriority;
  onChange: (v: TaskPriority) => void;
  collapsed?: boolean;
}) {
  const label = getPriorityLabel(value);
  const iconColor = getPriorityIconColor(value);
  const Icon =
    value === 0 ? Circle : value === 2 ? AlertTriangle : value === 4 ? Info : AlertCircle;
  const isEmpty = value === 0;

  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange(Number(v) as TaskPriority)}
    >
      <SelectTrigger
        className={cn(
          "h-8 border rounded-full bg-background group gap-1.5",
          collapsed ? "px-2 w-auto" : "px-3 text-xs w-auto"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className={cn('h-3 w-3 flex-shrink-0', iconColor, isEmpty && "opacity-40 group-hover:opacity-100")} />
        {!collapsed && (
          <span className={cn("truncate", isEmpty && "text-muted-foreground opacity-40 group-hover:opacity-100")}>{label}</span>
        )}
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_OPTIONS.map((o: { value: TaskPriority; label: string }) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TaskEstimateEntityPill({
  value,
  onChange,
  collapsed,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  collapsed?: boolean;
}) {
  const label = value ? getEstimateLabel(value) : null;
  const isEmpty = value == null;

  return (
    <Select
      value={value ? String(value) : 'none'}
      onValueChange={(v) => onChange(v === 'none' ? null : Number(v))}
    >
      <SelectTrigger
        className={cn(
          "h-8 border rounded-full bg-background group gap-1.5",
          collapsed ? "px-2 w-auto" : "px-3 text-xs w-auto"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Gauge className={cn("h-3 w-3 text-muted-foreground flex-shrink-0", isEmpty && "opacity-40 group-hover:opacity-100")} />
        {!collapsed && (
          <span className={cn("truncate", isEmpty && "text-muted-foreground opacity-40 group-hover:opacity-100")}>{label || 'Estimate'}</span>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {ESTIMATE_OPTIONS.map((o: { value: number; label: string }) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
