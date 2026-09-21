export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function scalePercent(
  value: number,
  minimum: number,
  maximum: number,
) {
  return clampPercent(((value - minimum) / (maximum - minimum)) * 100);
}

export function scorePillsOverlap(
  scorePercent: number | null,
  targetPercent: number | null,
) {
  return (
    scorePercent != null &&
    targetPercent != null &&
    Math.abs(scorePercent - targetPercent) < 18
  );
}

export function gapDetail(score: number, target: number | null) {
  if (target == null) return null;
  const delta = Math.round(Math.abs(score - target));
  return target <= score
    ? `${delta} points ahead of target`
    : `${delta} points to target`;
}

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function hitRect<T extends Rect>(
  items: T[],
  pageX: number,
  pageY: number,
) {
  return (
    items.find(
      (item) =>
        pageX >= item.x &&
        pageX <= item.x + item.width &&
        pageY >= item.y &&
        pageY <= item.y + item.height,
    ) ?? null
  );
}
