"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Search,
  X,
  Zap,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CommandPalettePage } from "../config/commandPalette.config";
import {
  paletteEntities,
  type EntityTarget,
  type PaletteCommand,
  type PaletteEntity,
  type PaletteEntityType,
  type PaletteSearch,
  type SearchPaletteEntities,
} from "../model";
import { EntityPill } from "./EntityPill";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { focusCommandPaletteInput } from "@altitutor/shared";

type Frame =
  | {
      label: string;
      mode: "entities";
      type: PaletteEntityType;
      subjectId?: string;
      topicId?: string;
      entity?: EntityTarget;
    }
  | { label: string; mode: "commands" | "create" | "pages" };
type Item = {
  id: string;
  title: string;
  icon: LucideIcon;
  parents?: string[];
  target?: EntityTarget;
  subtitle?: string;
  disabled?: boolean;
  destructive?: boolean;
  enter?: Frame[];
  action?: () => void;
};
interface PaletteBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onEntitySelected: (type: PaletteEntityType, id: string) => void;
  commands: PaletteCommand[];
  pages: CommandPalettePage[];
  onPageSelected?: (href: string) => void;
  searchEntities: SearchPaletteEntities;
}
const categoryTypes = (
  Object.keys(paletteEntities) as PaletteEntityType[]
).filter((type) => type !== "topic");
const matches = (value: string, search: string) =>
  search
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((token) => value.toLocaleLowerCase().includes(token));

export function PaletteBrowser({
  isOpen,
  onClose,
  onEntitySelected,
  commands,
  pages,
  onPageSelected,
  searchEntities,
}: PaletteBrowserProps) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);
  const [limit, setLimit] = useState(30);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = frames.at(-1);
  const query = search.trim();
  const debouncedQuery = useDebounce(query, 200);
  const enter = useCallback((next: Frame[]) => {
    setFrames(next);
    setSearch("");
    setSelected(0);
    setLimit(30);
    input.current?.focus();
    list.current?.scrollTo?.(0, 0);
  }, []);
  const back = () => enter(frames.slice(0, -1));
  useEffect(() => {
    if (!isOpen) return;
    enter([]);
    focusCommandPaletteInput(
      input.current,
      window.matchMedia("(max-width: 767px)").matches
        ? { delaysMs: [350] }
        : undefined,
    );
  }, [isOpen, enter]);
  const requests = useMemo<PaletteSearch[]>(() => {
    if (!isOpen || (current && current.mode !== "entities")) return [];
    if (current?.mode === "entities")
      return [
        {
          type: current.type,
          search: debouncedQuery,
          limit,
          subjectId: current.subjectId,
          topicId: current.topicId,
        },
      ];
    return debouncedQuery.length >= 2
      ? (Object.keys(paletteEntities) as PaletteEntityType[]).map((type) => ({
          type,
          search: debouncedQuery,
          limit: 8,
        }))
      : [];
  }, [current, debouncedQuery, isOpen, limit]);
  const queries = useQueries({
    queries: requests.map((request) => ({
      queryKey: ["command-palette", request],
      queryFn: () => searchEntities(request),
      staleTime: 0,
    })),
  });
  const pendingQuery = query !== debouncedQuery;
  const isLoading = pendingQuery || queries.some((result) => result.isFetching);
  const hasError = queries.some((result) => result.isError);
  const hasMore = queries.some((result) => result.data?.hasMore);
  const items: Item[] = [];
  if (!current) {
    for (const type of categoryTypes) {
      const config = paletteEntities[type];
      if (matches(config.label, query))
        items.push({
          id: `category-${type}`,
          title: config.label,
          icon: config.icon,
          enter: [{ label: config.label, mode: "entities", type }],
        });
    }
    if (matches("Commands actions create new go to", query))
      items.push({
        id: "commands",
        title: "Commands",
        icon: Zap,
        enter: [{ label: "Commands", mode: "commands" }],
      });
  }
  const commandFrame: Frame = { label: "Commands", mode: "commands" };
  if (current?.mode === "commands") {
    for (const frame of [
      { label: "Create new", mode: "create" } as const,
      { label: "Go to", mode: "pages" } as const,
    ]) {
      if (matches(frame.label, query))
        items.push({
          id: frame.mode,
          title: frame.label,
          icon: frame.mode === "create" ? Plus : ExternalLink,
          enter: [commandFrame, frame],
        });
    }
  }
  if (
    (!current && query) ||
    current?.mode === "commands" ||
    current?.mode === "create"
  ) {
    for (const command of commands) {
      if (current?.mode === "create" && command.target) continue;
      const parents = command.target
        ? ["Commands", ...(command.parents ?? [])]
        : ["Commands", "Create new"];
      if (
        matches(
          [
            ...parents,
            command.title,
            command.target?.title ?? "",
            ...(command.keywords ?? []),
          ].join(" "),
          query,
        )
      )
        items.push({
          ...command,
          id: `command-${command.id}`,
          parents:
            !current || current.mode === "commands"
              ? parents.slice(current ? 1 : 0)
              : undefined,
        });
    }
  }
  if (
    (!current && query) ||
    (current?.mode === "commands" && query) ||
    current?.mode === "pages"
  ) {
    for (const page of pages)
      if (matches([page.title, ...(page.keywords ?? [])].join(" "), query))
        items.push({
          id: `page-${page.id}`,
          title: page.title,
          icon: page.icon,
          parents:
            current?.mode === "pages"
              ? undefined
              : ["Commands", "Go to"].slice(current ? 1 : 0),
          action: () => {
            onClose();
            onPageSelected?.(page.href);
          },
        });
  }
  const openEntity = (entity: EntityTarget) => {
    onClose();
    onEntitySelected(entity.type, entity.id);
  };
  const entityItem = (entity: PaletteEntity): Item => {
    const config = paletteEntities[entity.type];
    const subjectId = entity.parents?.find(
      (parent) => parent.type === "subject",
    )?.id;
    const parentFrames: Frame[] = (entity.parents ?? []).map((parent) => ({
      label: parent.title,
      mode: "entities",
      type: "topic",
      subjectId: parent.type === "subject" ? parent.id : subjectId,
      topicId: parent.type === "topic" ? parent.id : undefined,
      entity: parent,
    }));
    const nested = entity.type === "subject" || entity.type === "topic";
    const next: Frame = {
      label: entity.title,
      mode: "entities",
      type: "topic",
      subjectId: entity.type === "subject" ? entity.id : subjectId,
      topicId: entity.type === "topic" ? entity.id : undefined,
      entity,
    };
    return {
      id: `${entity.type}-${entity.id}`,
      title: entity.title,
      icon: config.icon,
      subtitle: entity.subtitle,
      parents: !current
        ? [
            nested ? "Subjects" : config.label,
            ...(entity.parents ?? []).map((parent) => parent.title),
          ]
        : (entity.parents ?? [])
            .filter(
              (parent) =>
                !frames.some(
                  (frame) =>
                    frame.mode === "entities" && frame.entity?.id === parent.id,
                ),
            )
            .map((parent) => parent.title),
      enter: nested
        ? [
            { label: "Subjects", mode: "entities", type: "subject" },
            ...parentFrames,
            next,
          ]
        : undefined,
      action: nested ? undefined : () => openEntity(entity),
    };
  };
  if (
    current?.mode === "entities" &&
    current.entity &&
    matches(`Open ${current.entity.type} ${current.entity.title}`, query)
  )
    items.unshift({
      id: "open-current",
      title: `Open ${current.entity.type === "subject" ? "subject" : "topic"}`,
      target: current.entity,
      icon: ExternalLink,
      action: () => openEntity(current.entity!),
    });
  if (!pendingQuery)
    for (const result of queries)
      for (const entity of (result.isFetching ? [] : result.data?.results) ??
        [])
        items.push(entityItem(entity));
  useEffect(() => {
    setSelected(0);
  }, [search, current, limit]);
  const activeIndex = Math.min(selected, Math.max(0, items.length - 1));
  useEffect(() => {
    document
      .getElementById(`${listId}-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, listId]);
  const choose = (item: Item) => {
    if (!item.disabled) {
      if (item.enter) enter(item.enter);
      else {
        if (item.id.startsWith("command-")) onClose();
        item.action?.();
      }
    }
  };
  if (!isOpen) return null;
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (current) back();
          else onClose();
        }
      }}
    >
      <div className="shrink-0 border-b px-3 py-3">
        {frames.length > 0 && (
          <nav
            aria-label="Search scope"
            className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
          >
            <button
              className="rounded px-1.5 py-1 hover:bg-muted"
              onClick={() => enter([])}
            >
              Search
            </button>
            {frames.map((frame, index) => (
              <span
                key={`${frame.label}-${index}`}
                className="flex items-center gap-1"
              >
                <ChevronRight aria-hidden="true" className="h-3 w-3" />
                <button
                  className={`rounded px-1.5 py-1 hover:bg-muted ${index === frames.length - 1 ? "font-medium text-foreground" : ""}`}
                  onClick={() => enter(frames.slice(0, index + 1))}
                >
                  {frame.label}
                </button>
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2">
          {current ? (
            <button
              aria-label="Back one menu"
              className="rounded p-2 hover:bg-muted"
              onClick={back}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Search
              aria-hidden="true"
              className="ml-2 h-4 w-4 text-muted-foreground"
            />
          )}
          <input
            ref={input}
            type="search"
            role="searchbox"
            aria-label="Search commands and entities"
            aria-controls={listId}
            aria-activedescendant={
              items.length ? `${listId}-${activeIndex}` : undefined
            }
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={
              current
                ? `Search ${current.label}…`
                : "Search commands and entities…"
            }
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(30);
              setSelected(0);
            }}
            className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none md:text-sm"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                if (current) back();
                else onClose();
              }
              if (event.key === "Backspace" && !search && current) {
                event.preventDefault();
                back();
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setSelected(
                  (activeIndex +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    items.length) %
                    Math.max(items.length, 1),
                );
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (items[activeIndex]) choose(items[activeIndex]);
              }
            }}
          />
          {isLoading && (
            <Loader2
              aria-label="Searching"
              className="h-4 w-4 animate-spin text-muted-foreground"
            />
          )}
          <button
            aria-label="Close search"
            className="rounded p-2 text-muted-foreground hover:bg-muted"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={list}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
      >
        {hasError && (
          <div role="alert" className="p-3 text-sm text-destructive">
            Some results could not be loaded.{" "}
            <button
              className="underline"
              onClick={() =>
                queries.forEach((result) => {
                  void result.refetch();
                })
              }
            >
              Retry
            </button>
          </div>
        )}
        <div id={listId} role="listbox" aria-label="Search results">
          {items.map((item, index) => (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              aria-disabled={item.disabled || undefined}
              id={`${listId}-${index}`}
              key={item.id}
              onMouseMove={() => setSelected(index)}
              onClick={() => choose(item)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${activeIndex === index ? "bg-muted" : "hover:bg-muted/60"} ${item.disabled ? "opacity-50" : ""}`}
            >
              <item.icon
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  {item.parents?.map((parent, i) => (
                    <span
                      key={`${parent}-${i}`}
                      className="inline-flex items-center gap-1 text-muted-foreground"
                    >
                      {parent}
                      <ChevronRight aria-hidden="true" className="h-3 w-3" />
                    </span>
                  ))}
                  <span
                    className={`font-medium ${item.destructive ? "text-destructive" : "text-foreground"}`}
                  >
                    {item.title}
                  </span>
                  {item.target && <EntityPill entity={item.target} />}
                </span>
                {item.subtitle && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                )}
              </span>
              {item.enter && (
                <ChevronRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                />
              )}
            </button>
          ))}
        </div>
        {!items.length && !isLoading && !hasError && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No results found
          </div>
        )}
        {!current && query.length === 1 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Type at least 2 characters to search records.
          </p>
        )}
        {current?.mode === "entities" && hasMore && (
          <button
            className="w-full rounded p-3 text-sm hover:bg-muted"
            onClick={() => setLimit(limit + 30)}
          >
            Show more results
          </button>
        )}
      </div>
      <div className="hidden shrink-0 justify-between border-t px-4 py-2 text-xs text-muted-foreground md:flex">
        <span>↑↓ navigate · Enter select · Backspace back</span>
        <span>Esc {current ? "back" : "close"}</span>
      </div>
    </div>
  );
}
