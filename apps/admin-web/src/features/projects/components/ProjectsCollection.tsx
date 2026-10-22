"use client";
import {ProjectsList} from './ProjectsList';
/** The feature data/hooks and shared toolbar remain mounted across layout changes. */
export function ProjectsCollection({mode,defaultFilters}:{mode:'list'|'board';defaultFilters?:Record<string,unknown[]>}){return <ProjectsList layout={mode} defaultFilters={defaultFilters} />;}
