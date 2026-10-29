import styles from "./blog.module.css";
export interface DownloadResource {
  title: string;
  publisher: string;
  year?: string;
  href: string;
  sourceUrl: string;
  format?: string;
  note?: string;
}
function safeResourceUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"))
    return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
export function DownloadResources({
  resources,
}: {
  resources: readonly DownloadResource[];
}) {
  return (
    <ul className={styles.resources} aria-label="Downloadable resources">
      {resources.map((resource) => {
        if (
          !resource.title.trim() ||
          !resource.publisher.trim() ||
          !safeResourceUrl(resource.href) ||
          !safeResourceUrl(resource.sourceUrl)
        )
          throw new Error(
            "Downloadable resources need a title, publisher and safe source/file URLs",
          );
        return (
          <li key={`${resource.href}-${resource.year ?? ""}`}>
            <a href={resource.href}>
              {resource.title}
              {resource.year ? ` (${resource.year})` : ""}
              {resource.format ? ` · ${resource.format}` : ""}
            </a>
            <p>
              Source: <a href={resource.sourceUrl}>{resource.publisher}</a>
            </p>
            {resource.note ? <p>{resource.note}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
