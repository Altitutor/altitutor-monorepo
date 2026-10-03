"use client";
import { createContext, useContext } from "react";
import type {
  AccessoryTab,
  AccessoryDestination,
} from "./AccessoryPanelContext";
export type AccessoryTabScope = {
  tab: AccessoryTab;
  active: boolean;
  close: () => void;
  navigate: (destination: AccessoryDestination) => void;
  registerClose: (gate: ((next?: () => void) => void) | null) => void;
};
export const AccessoryTabContext = createContext<AccessoryTabScope | null>(
  null,
);
export function useAccessoryTab() {
  return useContext(AccessoryTabContext);
}
