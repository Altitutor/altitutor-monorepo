import type { Tables, Enums } from '@altitutor/shared';

/**
 * Utility functions for deriving topic codes and resource codes
 */

// Map of resource type to code abbreviations
const RESOURCE_TYPE_CODES: Record<Enums<'resource_type'>, string> = {
  NOTES: 'N',
  PRACTICE_QUESTIONS: 'PQ',
  TEST: 'T',
  VIDEO: 'V',
  EXAM: 'E',
  REVISION_SHEET: 'RS',
  CHEAT_SHEET: 'CS',
  FLASHCARDS: 'F',
};

/**
 * Recursively derives the topic code by traversing up the parent hierarchy
 * E.g., "5.2.3" for a topic with index 3, whose parent has index 2, whose parent has index 5
 * 
 * @param topic The topic to derive the code for
 * @param allTopics All topics (needed to look up parent topics)
 * @returns The topic code (e.g., "5.2.3")
 */
export function deriveTopicCode(
  topic: Tables<'topics'>,
  allTopics: Tables<'topics'>[]
): string {
  const codes: number[] = [];
  let currentTopic: Tables<'topics'> | undefined = topic;
  
  // Traverse up the hierarchy
  while (currentTopic) {
    codes.unshift(currentTopic.index); // Add to beginning of array
    
    // Find parent if it exists
    if (currentTopic.parent_id) {
      currentTopic = allTopics.find(t => t.id === currentTopic!.parent_id);
    } else {
      currentTopic = undefined;
    }
  }
  
  return codes.join('.');
}

/**
 * Derives the topic file code
 * Format: "{topic_code}{type_code}.{topic_files_index}"
 * E.g., "5.2.3PQ.1" for the first practice question in topic "5.2.3"
 * If is_solutions is true, append "_SOL": "5.2.3PQ.1_SOL"
 * 
 * @param topicFile The topic file to derive the code for
 * @param topicCode The topic code (from deriveTopicCode)
 * @param type The resource type
 * @returns The topic file code (e.g., "5.2.3PQ.1" or "5.2.3PQ.1_SOL")
 */
export function deriveTopicFileCode(
  topicFile: Tables<'topics_files'>,
  topicCode: string,
  type: Enums<'resource_type'>
): string {
  const typeCode = RESOURCE_TYPE_CODES[type];
  let code = `${topicCode}${typeCode}.${topicFile.index}`;
  
  if (topicFile.is_solutions) {
    code += '_SOL';
  }
  
  return code;
}

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
      code: deriveTopicCode(topic, topics),
      children: buildTopicTree(topics, topic.id),
    }));
  
  return children;
}

