export type ResourceSubjectImage = {
  filename: string | null;
  storage_path: string | null;
  bucket: string | null;
  mimetype: string | null;
};

export type ResourceTopicNode = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  index: number;
  children: ResourceTopicNode[];
};

export type ResourceFile = {
  id: string;
  topicId: string;
  code: string;
  type: string;
  index: number;
  filename: string;
  mimetype: string | null;
  /** Supabase object path when stored in bucket */
  storagePath: string | null;
  bucket: string | null;
  /** Off-platform HTTPS URL (e.g. YouTube/Vimeo); mutually exclusive with storage */
  externalUrl: string | null;
  isSolutions: boolean;
  isSolutionsOfId: string | null;
};

export type PairedResourceFile = {
  primary: ResourceFile;
  solution: ResourceFile | null;
};

/** Minimal topic row shape for tree helpers (student / tutor topic views). */
export type ResourceTopicRowInput = {
  id: string | null;
  code: string | null;
  name: string | null;
  parent_id: string | null;
  index: number | null;
};

/** Minimal topics_files row for mapping to ResourceFile. */
export type ResourceTopicFileRowInput = {
  id: string | null;
  topic_id: string | null;
  code: string | null;
  index: number | null;
  filename: string | null;
  external_url?: string | null;
  storage_path?: string | null;
  bucket?: string | null;
  type?: string | null;
  mimetype?: string | null;
  is_solutions?: boolean | null;
  is_solutions_of_id?: string | null;
};
