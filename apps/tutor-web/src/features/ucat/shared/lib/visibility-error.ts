/**
 * Parses UCAT visibility block error messages from the API.
 * Extracts the "Edit mock: /ucat/mocks/xxx" or "Edit set: /ucat/sets/xxx" link for display.
 */
const EDIT_LINK_REGEX = /Edit (mock|set): (\/ucat\/(mocks|sets)\/[a-f0-9-]+)/i

export function parseUcatVisibilityError(message: string): {
  message: string
  /** Text before the link (e.g. "Cannot change to private: ... first. ") */
  textBeforeLink?: string
  link?: { href: string; label: string }
} {
  const match = message.match(EDIT_LINK_REGEX)
  if (!match) {
    return { message }
  }
  const [fullMatch, type, path] = match
  const label = type === 'mock' ? 'Edit mock' : 'Edit set'
  const textBeforeLink = message.split(fullMatch)[0]?.trimEnd()
  return {
    message,
    textBeforeLink,
    link: { href: path, label },
  }
}
