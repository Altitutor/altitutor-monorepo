import type {
  ResourceFile,
  ResourceTopicFileRowInput,
  ResourceTopicNode,
  ResourceTopicRowInput,
} from './types';

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function buildTopicTree(topics: ResourceTopicRowInput[]): ResourceTopicNode[] {
  const nodes = new Map<string, ResourceTopicNode>();
  const roots: ResourceTopicNode[] = [];

  for (const topic of topics) {
    if (!topic.id || !topic.code || topic.index == null) continue;
    nodes.set(topic.id, {
      id: topic.id,
      code: topic.code,
      name: topic.name ?? topic.code,
      parentId: topic.parent_id,
      index: topic.index,
      children: [],
    });
  }

  for (const node of nodes.values()) {
    if (!node.parentId || !nodes.has(node.parentId)) {
      roots.push(node);
      continue;
    }
    nodes.get(node.parentId)?.children.push(node);
  }

  const sortTree = (tree: ResourceTopicNode[]) => {
    tree.sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
    for (const child of tree) sortTree(child.children);
  };

  sortTree(roots);
  return roots;
}

export function findTopicNodeInTree(nodes: ResourceTopicNode[], topicId: string): ResourceTopicNode | null {
  for (const node of nodes) {
    if (node.id === topicId) return node;
    const found = findTopicNodeInTree(node.children, topicId);
    if (found) return found;
  }
  return null;
}

/** Depth-first flatten of the topic tree — used for prev/next navigation. */
export function flattenTopicsDfs(tree: ResourceTopicNode[]): ResourceTopicNode[] {
  const out: ResourceTopicNode[] = [];
  const walk = (ns: ResourceTopicNode[]) => {
    for (const node of ns) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(tree);
  return out;
}

export function mapTopicFile(row: ResourceTopicFileRowInput): ResourceFile | null {
  if (!row.id || !row.topic_id || !row.code || row.index == null || !row.filename) {
    return null;
  }

  const externalUrl = row.external_url?.trim() || null;
  const hasStorage = Boolean(row.storage_path?.trim() && row.bucket?.trim());

  if (!externalUrl && !hasStorage) {
    return null;
  }

  return {
    id: row.id,
    topicId: row.topic_id,
    code: row.code,
    type: row.type ?? 'other',
    index: row.index,
    filename: row.filename,
    mimetype: row.mimetype ?? null,
    storagePath: row.storage_path?.trim() ? row.storage_path : null,
    bucket: row.bucket?.trim() ? row.bucket : null,
    externalUrl,
    isSolutions: Boolean(row.is_solutions),
    isSolutionsOfId: row.is_solutions_of_id ?? null,
  };
}

export function groupFilesByType(files: ResourceFile[]): Record<string, ResourceFile[]> {
  return files.reduce<Record<string, ResourceFile[]>>((acc, file) => {
    const key = file.type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {});
}

export function buildFileCountByTopic(rows: Pick<ResourceTopicFileRowInput, 'topic_id'>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.topic_id) continue;
    counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1);
  }
  return counts;
}

export function formatResourceTypeLabel(type: string): string {
  return (type || 'other')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Builds the canonical file title used on the file detail page.
 *
 * Format: `{file code} {topic name} {file type} {index?}`
 * The trailing index is only appended when the topic has more than
 * one file of the same type (so a single Test stays "Test", but
 * three Tests become "Test 1", "Test 2", "Test 3").
 */
export function buildResourceFileTitle(
  file: ResourceFile,
  topicName: string | null,
  topicFiles: ResourceFile[],
): string {
  const sameType = topicFiles
    .filter((f) => f.type === file.type)
    .sort((a, b) => a.index - b.index || a.code.localeCompare(b.code));
  const positionInType = sameType.findIndex((f) => f.id === file.id) + 1;
  const typeLabelText = formatResourceTypeLabel(file.type);
  const typeWithIndex = sameType.length > 1 ? `${typeLabelText} ${positionInType}` : typeLabelText;

  return [file.code, topicName ?? '', typeWithIndex]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * Flatten topic files in display order for prev/next navigation:
 * grouped by type, primaries paired with their solution immediately after.
 */
export function flattenTopicFilesForNav(files: ResourceFile[]): ResourceFile[] {
  const grouped = groupFilesByType(files);
  const out: ResourceFile[] = [];
  for (const typeFiles of Object.values(grouped)) {
    for (const { primary, solution } of pairFilesWithSolutions(typeFiles)) {
      out.push(primary);
      if (solution) out.push(solution);
    }
  }
  return out;
}

export function pairFilesWithSolutions(files: ResourceFile[]) {
  const byId = new Map(files.map((f) => [f.id, f]));
  return files
    .filter((file) => !file.isSolutions)
    .sort((a, b) => a.index - b.index)
    .map((primary) => ({
      primary,
      solution: files.find((f) => f.isSolutionsOfId === primary.id) ?? null,
    }))
    .concat(
      files
        .filter((file) => file.isSolutions && !file.isSolutionsOfId)
        .sort((a, b) => a.index - b.index)
        .map((orphanSolution) => ({
          primary: orphanSolution,
          solution: null,
        })),
    )
    .filter((pair) => byId.has(pair.primary.id));
}
