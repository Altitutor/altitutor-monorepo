"use client";
import {IssuesList} from './IssuesList';
/** The feature data/hooks and shared toolbar remain mounted across layout changes. */
export function IssuesCollection({mode,defaultFilters}:{mode:'list'|'board';defaultFilters?:Record<string,unknown[]>}){return <IssuesList layout={mode} defaultFilters={defaultFilters} />;}
