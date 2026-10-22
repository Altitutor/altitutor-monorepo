"use client";

import * as React from "react";
export type ToolbarView = {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};
const ToolbarViewContext = React.createContext<ToolbarView | undefined>(
  undefined,
);
export const ToolbarViewProvider = ToolbarViewContext.Provider;
export function useToolbarView() {
  return React.useContext(ToolbarViewContext);
}
