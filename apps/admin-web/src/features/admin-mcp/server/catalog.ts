import registry from "../catalog.json";

export const catalogVersion = "2026-09-13.1";
export type ReportingDataset = {
  name: string;
  area: string;
  description: string;
  rowGrain: { description: string; keys: string[] };
  limitations: string[];
  examples: string[];
  constraints: string[];
  fields: Record<
    string,
    {
      type: string;
      nullable: boolean;
      meaning: string;
      nullMeaning: string;
      values?: string[];
      timeSemantics?: string;
    }
  >;
  relationships: Array<{
    field: string;
    dataset: string;
    targetField: string;
    cardinality: string;
  }>;
};
export const datasets: ReportingDataset[] =
  registry as unknown as ReportingDataset[];
export function dataset(name: string) {
  const found = datasets.find((entry) => entry.name === name);
  if (!found)
    throw new Error(
      `Unknown reporting dataset: ${name}. Discover the catalog first.`,
    );
  return found;
}
export function describeCatalog(search = "", full = false) {
  const query = search.toLowerCase();
  return {
    version: catalogVersion,
    limitations: [
      "Existing records only; absent evidence is not zero.",
      "External PostHog, Stripe and accounting systems require their own connectors.",
      "Independent queries are not a cross-system snapshot.",
    ],
    datasets: datasets
      .filter((entry) =>
        `${entry.name} ${entry.area} ${entry.description}`
          .toLowerCase()
          .includes(query),
      )
      .map((entry) =>
        full
          ? entry
          : {
              name: entry.name,
              area: entry.area,
              description: entry.description,
            },
      ),
  };
}
