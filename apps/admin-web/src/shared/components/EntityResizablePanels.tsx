"use client";

import type { ReactNode } from "react";
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
}

export function EntityResizablePanels({
  id,
  main,
  sidebar,
  primaryMinSize,
  secondaryMinSize,
  inDialog = false,
}: EntityResizablePanelsProps) {
  return (
    <EntityPropertiesLayout
      id={`${id}-properties-sidebar`}
      sidebar={sidebar}
      resizable
      narrowAt={inDialog ? 768 : undefined}
      primaryMinSize={primaryMinSize}
      secondaryMinSize={secondaryMinSize}
    >
      {inDialog ? (
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
