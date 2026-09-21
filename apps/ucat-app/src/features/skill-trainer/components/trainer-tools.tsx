import {
  createContext,
  use,
  useRef,
  type PropsWithChildren,
  type RefObject,
} from "react";
type Tools = { exit: () => void };
const Context = createContext<RefObject<Tools | null> | null>(null);
export function TrainerToolsProvider({ children }: PropsWithChildren) {
  const tools = useRef<Tools | null>(null);
  return <Context value={tools}>{children}</Context>;
}
export function useTrainerTools() {
  const tools = use(Context);
  if (!tools) throw new Error("Missing trainer tools provider");
  return tools;
}
