import type { Database, Json } from "@altitutor/shared";

export type LearningModuleRow =
  Database["public"]["Views"]["vstudent_ucat_learning_modules"]["Row"];

export type LearningModuleBlockRow =
  Database["public"]["Views"]["vstudent_ucat_learning_module_blocks"]["Row"];

export type LearningModuleBlockType =
  Database["public"]["Enums"]["ucat_learning_module_block_type"];

export type LearningModuleKind =
  Database["public"]["Enums"]["ucat_learning_module_kind"];

export type LearningModuleDisplayMode =
  Database["public"]["Enums"]["ucat_learning_module_display_mode"];

export type LearningModuleTreeNode = LearningModuleRow & {
  children: LearningModuleTreeNode[];
};

export type LearningLessonDetail = {
  module: LearningModuleRow;
  blocks: LearningModuleBlockRow[];
};

export type BlockInteractionState = {
  scrollPercent?: number;
  videoWatchPercent?: number;
  fileViewed?: boolean;
  fileLinkClicked?: boolean;
};

export type BlockProgressPayload = {
  interactionState?: Json;
  completed?: boolean;
  manuallyCompleted?: boolean;
};
