import {
  createContext,
  use,
  useRef,
  type PropsWithChildren,
  type RefObject,
} from "react";
type Tools = {
  exit: () => void;
  review: () => void;
  canReview: boolean;
  questions?: {
    index: number;
    stemId: string;
    label: string;
    answered: boolean;
    flagged: boolean;
    current: boolean;
    disabled: boolean;
  }[];
  jump?: (index: number) => void;
};
const Context = createContext<RefObject<Tools | null> | null>(null);
export function ExamToolsProvider({ children }: PropsWithChildren) {
  const tools = useRef<Tools | null>(null);
  return <Context value={tools}>{children}</Context>;
}
export function useExamTools() {
  const tools = use(Context);
  if (!tools) throw new Error("Exam tools require a provider.");
  return tools;
}
