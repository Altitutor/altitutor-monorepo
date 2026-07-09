import type { FormAccessType, FormBlock, FormSubmissionLimit } from '@altitutor/shared';

export interface AdminFormRow {
  id: string;
  name: string;
  purpose: string;
  status: string;
  access_type: FormAccessType;
  submission_limit: FormSubmissionLimit;
  draft_blocks: FormBlock[];
  draft_thank_you_message: string;
  latest_published_version_id: string | null;
  created_at: string;
  updated_at: string;
  response_count?: number;
}

export interface AdminFormVersionRow {
  id: string;
  form_id: string;
  version_number: number;
  blocks: FormBlock[];
  thank_you_message: string;
  published_at: string;
}

export interface AdminFormTokenRow {
  id: string;
  form_id: string;
  form_version_id: string;
  access_type: FormAccessType;
  submission_limit: FormSubmissionLimit;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  token?: string;
}
