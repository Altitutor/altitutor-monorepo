/**
 * Database utility functions for transforming data between camelCase and snake_case
 */

/**
 * Utility function to convert camelCase to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Utility function to convert snake_case to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform database record with snake_case fields to camelCase for TypeScript
 */
export function transformToCamelCase(data: Record<string, any>): Record<string, any> {
  if (!data) return data;
  
  const result: Record<string, any> = {};

  for (const key in data) {
    if (key.includes('_')) {
      // Convert snake_case to camelCase
      const camelKey = toCamelCase(key);
      result[camelKey] = data[key];
    } else {
      // Keep as is if not snake_case
      result[key] = data[key];
    }
  }
  
  return result;
}

/**
 * Convert TypeScript object with camelCase properties to database format with snake_case columns
 */
export function convertToDbFormat(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in data) {
    // Skip properties that start with underscore or are undefined
    if (key.startsWith('_') || data[key] === undefined) continue;
    
    // Skip relation properties (usually objects or arrays)
    if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key]) && !(data[key] instanceof Date)) {
      continue;
    }
    
    // Convert camelCase to snake_case
    const dbKey = toSnakeCase(key);
    result[dbKey] = data[key];
  }
  
  return result;
} 