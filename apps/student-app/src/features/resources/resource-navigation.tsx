import type { ResourceTopicNode } from '@altitutor/shared';
import { createContext, use, useRef, type PropsWithChildren, type RefObject } from 'react';

type RouteDispatcher = {
  dispatch: (action: { type: string; payload?: object; source?: string }) => void;
};

/** Updates a screen that stays mounted under a sheet. Global setParams would hit the sheet instead. */
export function setRouteParams(navigation: RouteDispatcher, routeKey: string, params: Record<string, string>) {
  navigation.dispatch({
    type: 'SET_PARAMS',
    payload: { params },
    source: routeKey,
  });
}

export type TopicNavigation = {
  subjectId: string;
  topicId: string;
  tree: ResourceTopicNode[];
  jump: (topic: { id: string; name: string }) => void;
};

export type FileNavigation = {
  topicId: string;
  currentId: string;
  files: { id: string; title: string; detail?: string }[];
  jump: (fileId: string) => void;
};

const TopicContext = createContext<RefObject<TopicNavigation | null> | null>(null);
const FileContext = createContext<RefObject<FileNavigation | null> | null>(null);

export function ResourceNavigationProvider({ children }: PropsWithChildren) {
  const topics = useRef<TopicNavigation | null>(null);
  const files = useRef<FileNavigation | null>(null);
  return (
    <TopicContext.Provider value={topics}>
      <FileContext.Provider value={files}>{children}</FileContext.Provider>
    </TopicContext.Provider>
  );
}

export function useTopicNavigation() {
  const ref = use(TopicContext);
  if (!ref) throw new Error('Missing topic navigation');
  return ref;
}

export function useFileNavigation() {
  const ref = use(FileContext);
  if (!ref) throw new Error('Missing file navigation');
  return ref;
}
