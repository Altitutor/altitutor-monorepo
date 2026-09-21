import {
  createContext,
  use,
  useRef,
  type PropsWithChildren,
  type RefObject,
} from "react";
export type LessonNavigation = {
  parts: { id: string; title: string; complete: boolean }[];
  index: number;
  jump: (index: number) => void;
};
const Context = createContext<RefObject<LessonNavigation | null> | null>(null);
export function LessonNavigationProvider({ children }: PropsWithChildren) {
  const navigation = useRef<LessonNavigation | null>(null);
  return <Context value={navigation}>{children}</Context>;
}
export function useLessonNavigation() {
  const ref = use(Context);
  if (!ref) throw new Error("Missing lesson navigation");
  return ref;
}
