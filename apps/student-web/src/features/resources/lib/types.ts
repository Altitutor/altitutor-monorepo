import type { Database } from '@altitutor/shared';
import type { ResourceFile, ResourceSubjectImage, ResourceTopicNode, PairedResourceFile } from '@altitutor/shared';

export type { ResourceFile, ResourceSubjectImage, ResourceTopicNode, PairedResourceFile };

export type StudentSubjectRow = Database['public']['Views']['vstudent_subjects']['Row'];
export type StudentTopicRow = Database['public']['Views']['vstudent_topics']['Row'];
export type StudentTopicFileRow = Database['public']['Views']['vstudent_topics_files']['Row'];
export type StudentSubjectAccessRow = Database['public']['Views']['vstudent_my_subject_access']['Row'];

export type ResourceAccessSource = 'class_enrollment' | 'subscription' | 'manual';

export type ResourceSubject = StudentSubjectRow & {
  image?: ResourceSubjectImage | null;
};
