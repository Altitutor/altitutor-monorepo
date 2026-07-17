import type {
  HistoricalProjectionPoint,
  ProjectionPoint,
} from "@/features/score-projection/types/score-projection";

export type ProjectionGraphSource = {
  currentEstimate: number;
  history: HistoricalProjectionPoint[];
  projection: ProjectionPoint[];
};

export type ProjectionGraphData = {
  data: { date: string; value: number | null }[];
  projection: {
    pessimistic: { date: string; value: number }[];
    realistic: { date: string; value: number }[];
    optimistic: { date: string; value: number }[];
  };
};

export function buildProjectionGraph(
  projection: ProjectionGraphSource,
): ProjectionGraphData {
  const currentPoint = projection.projection.find((point) => point.day === 0);
  const currentDate =
    currentPoint?.date ?? new Date().toISOString().slice(0, 10);
  const historyData = projection.history.map((point) => ({
    date: point.date,
    value: point.value,
  }));
  const data = historyData.some((point) => point.date === currentDate)
    ? historyData
    : [
        ...historyData,
        {
          date: currentDate,
          value: projection.currentEstimate,
        },
      ];

  return {
    data,
    projection: {
      pessimistic: projection.projection.map((point) => ({
        date: point.date,
        value: point.pessimistic,
      })),
      realistic: projection.projection.map((point) => ({
        date: point.date,
        value: point.realistic,
      })),
      optimistic: projection.projection.map((point) => ({
        date: point.date,
        value: point.optimistic,
      })),
    },
  };
}
