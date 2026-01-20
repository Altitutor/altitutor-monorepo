import type { Tables, Enums } from '@altitutor/shared';

/**
 * Utility functions for deriving topic codes and resource codes
 */

// Map of resource type to code abbreviations
// Note: Currently unused but kept for potential future use
// const RESOURCE_TYPE_CODES: Record<Enums<'resource_type'>, string> = {
//   NOTES: 'N',
//   PRACTICE_QUESTIONS: 'PQ',
//   TEST: 'T',
//   VIDEO: 'V',
//   EXAM: 'E',
//   REVISION_SHEET: 'RS',
//   CHEAT_SHEET: 'CS',
//   FLASHCARDS: 'F',
// };

// Note: deriveTopicCode and deriveTopicFileCode have been removed.
// Codes are now stored in the database and should be accessed via topic.code and topicFile.code

/**
 * Gets the next available index for a topic given its subject and parent
 * Returns 1 if no topics exist, otherwise returns max(index) + 1
 * 
 * @param subjectId The subject ID
 * @param parentId The parent topic ID (null for root topics)
 * @param existingTopics All existing topics for this subject
 * @returns The next available index
 */
export function getNextTopicIndex(
  subjectId: string,
  parentId: string | null,
  existingTopics: Tables<'topics'>[]
): number {
  // Filter topics with same subject and parent
  const siblings = existingTopics.filter(
    t => t.subject_id === subjectId && t.parent_id === parentId
  );
  
  if (siblings.length === 0) {
    return 1;
  }
  
  // Find max index
  const maxIndex = Math.max(...siblings.map(t => t.index));
  return maxIndex + 1;
}

/**
 * Gets the next available index for a topic file
 * Returns 1 if no topic files exist, otherwise returns max(index) + 1
 * 
 * @param topicId The topic ID
 * @param type The resource type
 * @param isSolutions Whether this is a solutions file
 * @param existingTopicFiles All existing topic files for this topic
 * @returns The next available index
 */
export function getNextTopicFileIndex(
  topicId: string,
  type: Enums<'resource_type'>,
  isSolutions: boolean,
  existingTopicFiles: Tables<'topics_files'>[]
): number {
  // Filter topic files with same topic, type, and is_solutions
  const siblings = existingTopicFiles.filter(
    tf => tf.topic_id === topicId && tf.type === type && tf.is_solutions === isSolutions
  );
  
  if (siblings.length === 0) {
    return 1;
  }
  
  // Find max index
  const maxIndex = Math.max(...siblings.map(tf => tf.index));
  return maxIndex + 1;
}

/**
 * Builds a hierarchical tree of topics
 * 
 * @param topics All topics
 * @param parentId The parent ID to start from (null for root topics)
 * @returns Array of topics with their children nested
 */
export type TopicTree = Tables<'topics'> & {
  children: TopicTree[];
  code: string;
};

export function buildTopicTree(
  topics: Tables<'topics'>[],
  parentId: string | null = null
): TopicTree[] {
  const children = topics
    .filter(t => t.parent_id === parentId)
    .sort((a, b) => a.index - b.index)
    .map(topic => ({
      ...topic,
      code: topic.code, // Use stored code from database
      children: buildTopicTree(topics, topic.id),
    }));
  
  return children;
}

