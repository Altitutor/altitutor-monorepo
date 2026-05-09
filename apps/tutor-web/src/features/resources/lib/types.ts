import type { Database } from '@altitutor/shared';
import type { PairedResourceFile, ResourceFile, ResourceSubjectImage, ResourceTopicNode } from '@altitutor/shared';

export type { PairedResourceFile, ResourceFile, ResourceSubjectImage, ResourceTopicNode };

export type TutorSubjectRow = Database['public']['Views']['vtutor_subjects']['Row'];
export type TutorTopicRow = Database['public']['Views']['vtutor_topics']['Row'];
export type TutorTopicFileRow = Database['public']['Views']['vtutor_topics_files']['Row'];

export type ResourceSubject = TutorSubjectRow & {
  image?: ResourceSubjectImage | null;
};
