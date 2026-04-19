"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Position = {
  x: number;
  y: number;
};

type DragState = {
  isDragging: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

export function useDraggablePanel(initialPosition: Position = { x: 0, y: 0 }) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const dragState = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState.current.isDragging) return;

    const deltaX = event.clientX - dragState.current.startX;
    const deltaY = event.clientY - dragState.current.startY;

    setPosition({
      x: dragState.current.originX + deltaX,
      y: dragState.current.originY + deltaY,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragState.current.isDragging) return;

    dragState.current.isDragging = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      event.preventDefault();

      dragState.current.isDragging = true;
      dragState.current.startX = event.clientX;
      dragState.current.startY = event.clientY;
      dragState.current.originX = position.x;
      dragState.current.originY = position.y;

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, handleMouseUp, position.x, position.y],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    position,
    handleMouseDown,
    setPosition,
  };
}
