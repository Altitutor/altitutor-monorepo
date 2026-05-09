import type { Database } from '@altitutor/shared';

export type StudentSubjectRow = Database['public']['Views']['vstudent_subjects']['Row'];
export type StudentTopicRow = Database['public']['Views']['vstudent_topics']['Row'];
export type StudentTopicFileRow = Database['public']['Views']['vstudent_topics_files']['Row'];
export type StudentSubjectAccessRow = Database['public']['Views']['vstudent_my_subject_access']['Row'];

export type ResourceAccessSource = 'class_enrollment' | 'subscription' | 'manual';

export type ResourceSubject = StudentSubjectRow & {
  image?: {
    filename: string | null;
    storage_path: string | null;
    bucket: string | null;
    mimetype: string | null;
  } | null;
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
