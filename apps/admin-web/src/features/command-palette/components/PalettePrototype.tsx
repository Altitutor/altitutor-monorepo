'use client';

// THROWAWAY DEV-211: compare drilldown, sidebar and tabs in the existing admin overlay.
// Read-only local fixtures; command activation is deliberately a simulation.
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, X, Zap } from 'lucide-react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { entityTypes, commands } from '../config/commandPalette.config';
import { navItems } from './CommandPalette';

type Row = { id: string; title: string; path: string[]; children?: Row[]; icon: typeof Search };
const names = ['Students', 'Parents', 'Staff', 'Subjects', 'Classes', 'Tasks', 'Projects', 'Issues', 'Documents', 'Files', 'Commands'];
const variants = ['A', 'B', 'C'];
const variantNames = ['Drilldown', 'Category sidebar', 'Compact tabs'];

export function PalettePrototype({ onClose }: { onClose: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const variant = params.get('variant') ?? 'A';
  const [path, setPath] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [activated, setActivated] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const { data: roots = [], isLoading, error } = useQuery({
    queryKey: ['dev211-prototype-fixtures'],
    queryFn: async () => {
      const db = getSupabaseClient();
      const [students, subjects, topics] = await Promise.all([
        db.from('students').select('id,first_name,last_name,status').is('deleted_at', null).in('status', ['ACTIVE', 'TRIAL']).order('first_name').limit(20),
        db.from('subjects').select('id,long_name,short_name').order('long_name').limit(100),
        db.from('topics').select('id,name,subject_id,parent_id,code').order('index').limit(500),
      ]);
      for (const response of [students, subjects, topics]) if (response.error) throw response.error;
      const rows: Row[] = names.map(name => ({ id: name, title: name, path: [], children: [], icon: name === 'Commands' ? Zap : Object.values(entityTypes).find(c => c.label === (name === 'Documents' ? 'Notes' : name))?.icon ?? Search }));
      const studentRoot = rows[0];
      studentRoot.children = (students.data ?? []).map(s => ({ id: s.id, title: `${s.first_name} ${s.last_name}`, path: ['Students'], icon: studentRoot.icon }));
      const subjectRoot = rows[3];
      const buildTopics = (subjectId: string, parentId: string | null, trail: string[], visited: Set<string>): Row[] => (topics.data ?? [])
        .filter(t => t.subject_id === subjectId && t.parent_id === parentId && !visited.has(t.id))
        .map(t => {
          const title = `${t.code ?? ''} ${t.name}`.trim();
          const children = buildTopics(subjectId, t.id, [...trail, title], new Set([...visited, t.id]));
          return { id: t.id, title, path: trail, icon: entityTypes.topics.icon, children: [
            { id: `open-${t.id}`, title: `Open ${title}`, path: [...trail, title], icon: entityTypes.topics.icon }, ...children,
          ] };
        });
      subjectRoot.children = (subjects.data ?? []).map(s => {
        const title = s.short_name ?? s.long_name ?? 'Subject';
        return { id: s.id, title, path: ['Subjects'], icon: subjectRoot.icon, children: [
          { id: `open-${s.id}`, title: `Open ${title}`, path: ['Subjects', title], icon: subjectRoot.icon },
          ...buildTopics(s.id, null, ['Subjects', title], new Set()),
        ] };
      });
      const firstStudent = studentRoot.children[0];
      rows[rows.length - 1].children = [
        { id: 'create', title: 'Create new', path: ['Commands'], icon: Zap, children: commands.map(c => ({ id: c.id, title: c.title, icon: c.icon, path: ['Commands', 'Create new'] })) },
        { id: 'goto', title: 'Go to', path: ['Commands'], icon: ChevronRight, children: navItems.map(p => ({ id: p.href, title: p.title, icon: p.icon, path: ['Commands', 'Go to'] })) },
        ...['Copy ID', 'Message', 'Log absence for', 'Add to homework help:'].map(title => ({ id: title, title: `${title} ${firstStudent?.title ?? 'student'}`, icon: studentRoot.icon, path: ['Commands', 'Student'], })),
      ];
      return rows;
    },
  });
  const current = path[path.length - 1];
  const children = current ? current.children ?? [] : roots;
  const flatten = (rows: Row[]): Row[] => rows.flatMap(row => [row, ...(row.children ? flatten(row.children) : [])]);
  const normalized = query.trim().toLowerCase();
  const visible = normalized ? flatten(children).filter(row => `${row.path.join(' ')} ${row.title}`.toLowerCase().includes(normalized)) : children;
  const changePath = (next: Row[]) => { setPath(next); setQuery(''); setSelected(0); setActivated(''); input.current?.focus(); };
  const choose = (row: Row) => {
    if (row.children) {
      const ancestors = row.path.reduce<Row[]>((trail, title) => {
        const match = (trail.at(-1)?.children ?? roots).find(item => item.title === title);
        return match ? [...trail, match] : trail;
      }, []);
      changePath([...ancestors, row]);
    } else setActivated(`Preview only: ${row.path.join(' > ')} > ${row.title}`);
  };
  const cycle = (direction: number) => {
    const next = variants[(Math.max(0, variants.indexOf(variant)) + direction + 3) % 3];
    const nextParams = new URLSearchParams(params.toString()); nextParams.set('variant', next);
    router.replace(`${pathname}?${nextParams}`);
  };
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); cycle(event.key === 'ArrowLeft' ? -1 : 1); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  const categoryButtons = roots.map(root => <button key={root.id} onClick={() => changePath([root])} className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${path[0]?.id === root.id ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'}`}><root.icon className="h-4 w-4 shrink-0" />{root.title}</button>);
  return <div className="flex h-full min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground"><span>DEV-211 · THROWAWAY DESIGN PREVIEW · commands simulate only</span><button aria-label="Close prototype" onClick={onClose}><X className="h-4 w-4" /></button></div>
    <div className="flex min-h-0 flex-1">
      {variant === 'B' && <aside aria-label="Entity categories" className="hidden w-48 shrink-0 flex-col gap-1 overflow-auto border-r p-2 md:flex"><button className="px-3 py-2 text-left text-sm" onClick={() => changePath([])}>All results</button>{categoryButtons}</aside>}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1 px-4 pt-4 text-xs"><button className="rounded bg-muted px-2 py-1" onClick={() => changePath([])}>Search</button>{path.map((part, i) => <span key={part.id} className="flex items-center gap-1"><ChevronRight className="h-3 w-3"/><button className="rounded bg-muted px-2 py-1" onClick={() => changePath(path.slice(0, i + 1))}>{part.title}</button></span>)}</div>
        <div className="flex items-center gap-2 border-b px-4 py-3">{path.length > 0 ? <button aria-label="Back one menu" onClick={() => changePath(path.slice(0, -1))}><ArrowLeft className="h-4 w-4"/></button> : <Search className="h-4 w-4"/>}<input ref={input} aria-label="Search prototype" className="min-w-0 flex-1 bg-transparent py-1 text-base outline-none" placeholder={current ? `Search within ${current.title}…` : 'Search everything or choose a submenu…'} value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected((selected + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % Math.max(visible.length, 1)); }
          if (event.key === 'Enter' && visible[selected]) { event.preventDefault(); choose(visible[selected]); }
          if (event.key === 'Backspace' && !query && path.length) { event.preventDefault(); changePath(path.slice(0, -1)); }
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (path.length) changePath(path.slice(0, -1)); else onClose(); }
        }}/>{isLoading && <span className="text-xs">Loading…</span>}</div>
        {variant === 'C' && <div aria-label="Entity tabs" className="flex shrink-0 gap-1 overflow-auto border-b p-2">{categoryButtons}</div>}
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {error && <p className="p-4 text-sm text-destructive">Could not load local fixtures.</p>}
          {visible.map((row, index) => <button key={`${row.path.join('/')}/${row.id}`} className={`flex w-full items-center gap-3 rounded-lg px-3 ${variant === 'C' ? 'py-2' : 'py-3'} text-left ${selected === index ? 'bg-primary/10' : 'hover:bg-muted'}`} onMouseEnter={() => setSelected(index)} onClick={() => choose(row)}><row.icon className="h-4 w-4 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{normalized && row.path.length ? `${row.path.join(' > ')} > ` : ''}{row.title}</span>{row.children && <span className="text-xs text-muted-foreground">{row.children.length ? `${row.children.length} ${row.id === 'Subjects' ? 'subjects' : 'options'}` : 'Category · sample data not loaded'}</span>}</span>{row.children ? <ChevronRight className="h-4 w-4 text-muted-foreground"/> : <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">{row.path[0]}</span>}</button>)}
          {!isLoading && !visible.length && <p className="p-6 text-center text-sm text-muted-foreground">No matching preview records.</p>}
          {activated && <p role="status" className="m-2 rounded border p-3 text-sm">{activated}</p>}
        </div>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">↑↓ select · Enter open · Backspace / Esc back · scope: {path.map(p => p.title).join(' > ') || 'All'} · query: {query || '(empty)'}</div>
      </div>
    </div>
    <div className="fixed bottom-5 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-5 rounded-full bg-slate-950 px-5 py-3 text-sm text-white shadow-xl"><button aria-label="Previous variant" onClick={() => cycle(-1)}><ChevronLeft className="h-5 w-5"/></button><span>{variant} — {variantNames[variants.indexOf(variant)]}</span><button aria-label="Next variant" onClick={() => cycle(1)}><ChevronRight className="h-5 w-5"/></button></div>
  </div>;
}
