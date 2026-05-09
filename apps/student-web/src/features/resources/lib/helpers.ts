import type {
  ResourceFile,
  ResourceTopicNode,
  StudentTopicRow,
  StudentTopicFileRow,
} from './types';

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function buildTopicTree(topics: StudentTopicRow[]): ResourceTopicNode[] {
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

export function findTopicNodeInTree(
  nodes: ResourceTopicNode[],
  topicId: string,
): ResourceTopicNode | null {
  for (const node of nodes) {
    if (node.id === topicId) return node;
    const found = findTopicNodeInTree(node.children, topicId);
    if (found) return found;
  }
  return null;
}

export function mapTopicFile(row: StudentTopicFileRow): ResourceFile | null {
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
    mimetype: row.mimetype,
    storagePath: row.storage_path?.trim() ? row.storage_path : null,
    bucket: row.bucket?.trim() ? row.bucket : null,
    externalUrl,
    isSolutions: Boolean(row.is_solutions),
    isSolutionsOfId: row.is_solutions_of_id,
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
        }))
    )
    .filter((pair) => byId.has(pair.primary.id));
}
