"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import {
  EntityPropertiesLayout,
  EntityPropertiesToggle,
} from "./EntityPropertiesLayout";

interface EntityResizablePanelsProps {
  id: string;
  main: ReactNode;
  sidebar: ReactNode;
  primaryMinSize?: number;
  secondaryMinSize?: number;
  inDialog?: boolean;
  toggleTarget?: HTMLDivElement | null;
}

export function EntityResizablePanels({
  id,
  main,
  sidebar,
  primaryMinSize,
  secondaryMinSize,
  inDialog = false,
  toggleTarget,
}: EntityResizablePanelsProps) {
  const toggleInHeader = toggleTarget !== undefined;
  return (
    <EntityPropertiesLayout
      id={`${id}-properties-sidebar`}
      sidebar={sidebar}
      resizable
      collapsible={toggleInHeader}
      narrowAt={inDialog ? 768 : undefined}
      primaryMinSize={primaryMinSize}
      secondaryMinSize={secondaryMinSize}
    >
      {toggleInHeader ? (
        <>
          {toggleTarget && createPortal(<EntityPropertiesToggle />, toggleTarget)}
          {main}
        </>
      ) : inDialog ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 justify-end px-3 pt-3 empty:hidden">
            <EntityPropertiesToggle />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{main}</div>
        </div>
      ) : (
        <>
          <AdminPageActions priority="secondary">
            <EntityPropertiesToggle />
          </AdminPageActions>
          {main}
        </>
      )}
    </EntityPropertiesLayout>
  );
}
