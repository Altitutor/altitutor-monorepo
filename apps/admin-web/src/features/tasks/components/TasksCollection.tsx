"use client";
import {TasksList} from './TasksList';
/** The feature data/hooks and shared toolbar remain mounted across layout changes. */
export function TasksCollection({mode,defaultFilters}:{mode:'list'|'board';defaultFilters?:Record<string,unknown[]>}){return <TasksList layout={mode} defaultFilters={defaultFilters} />;}
