/**
 * Replace {variable_name} placeholders in template content with actual values.
 * Case-insensitive variable matching.
 */
export function replaceTemplateVariables(
  content: string,
  replacements: Record<string, string>
): string {
  let result = content;
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`\\{${escapeRegex(key)}\\}`, 'gi');
    result = result.replace(regex, value ?? '');
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
