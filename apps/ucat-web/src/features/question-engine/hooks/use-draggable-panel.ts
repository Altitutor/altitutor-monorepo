"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Position = {
  x: number;
  y: number;
};

type DragState = {
  isDragging: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

export function useDraggablePanel(initialPosition: Position = { x: 0, y: 0 }) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const dragState = useRef<DragState>({
    isDragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!dragState.current.isDragging) return;
    if (dragState.current.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.current.startX;
    const deltaY = event.clientY - dragState.current.startY;

    setPosition({
      x: dragState.current.originX + deltaX,
      y: dragState.current.originY + deltaY,
    });
  }, []);

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      if (!dragState.current.isDragging) return;
      if (dragState.current.pointerId !== event.pointerId) return;

      dragState.current.isDragging = false;
      dragState.current.pointerId = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    },
    [handlePointerMove],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button")) return;

      event.preventDefault();

      dragState.current.isDragging = true;
      dragState.current.pointerId = event.pointerId;
      dragState.current.startX = event.clientX;
      dragState.current.startY = event.clientY;
      dragState.current.originX = position.x;
      dragState.current.originY = position.y;

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, position.x, position.y],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return {
    position,
    handlePointerDown,
    setPosition,
  };
}
