import {
  createContext,
  use,
  useState,
  type PropsWithChildren,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { NavigatorQuestion } from "@/features/question-engine/components/question-grid";

type ReviewNavigation = {
  questions: NavigatorQuestion[];
  jump: (index: number) => void;
};
const Context = createContext<{
  navigation: ReviewNavigation | null;
  setNavigation: Dispatch<SetStateAction<ReviewNavigation | null>>;
} | null>(null);

export function ReviewNavigationProvider({ children }: PropsWithChildren) {
  const [navigation, setNavigation] = useState<ReviewNavigation | null>(null);
  return <Context value={{ navigation, setNavigation }}>{children}</Context>;
}

export function useReviewNavigation() {
  const context = use(Context);
  if (!context) throw new Error("Review navigation requires a provider.");
  return context;
}
