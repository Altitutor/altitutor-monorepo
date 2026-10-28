import type { MDXComponents } from "mdx/types";
import { DownloadResources } from "@/features/blog/download-resources";

// Repository-authored MDX only. Never compile arbitrary user-submitted content.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { DownloadResources, ...components };
}
